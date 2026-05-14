import { Hono } from "hono";
import type { Env, SessionData } from "../types";
import { createSession, deleteSession, getSession } from "../services/session";
import { upsertUser } from "../db/queries";
import { nanoid } from "nanoid";

type AuthApp = { Bindings: Env; Variables: { userId: string; session: SessionData } };

const auth = new Hono<AuthApp>();

// In-memory CSRF state store (acceptable for Workers — each isolate is short-lived)
const pendingStates = new Map<string, number>();

// GET /auth/client-id — frontend fetches this to build the Google OAuth URL
auth.get("/client-id", (c) => {
  const state = nanoid(32);
  pendingStates.set(state, Date.now());

  // Prune old states (>5 min)
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const [key, ts] of pendingStates) {
    if (ts < cutoff) pendingStates.delete(key);
  }

  return c.json({
    client_id: c.env.GOOGLE_CLIENT_ID,
    state,
  });
});

// POST /auth/token — exchange authorization code for session
auth.post("/token", async (c) => {
  const body = await c.req.json<{
    code: string;
    redirect_uri: string;
    state?: string;
  }>();

  if (!body.code || !body.redirect_uri) {
    return c.json({ error: "bad_request", message: "code and redirect_uri required" }, 400);
  }

  // Validate CSRF state if provided
  if (body.state) {
    if (!pendingStates.has(body.state)) {
      return c.json({ error: "invalid_state", message: "Invalid or expired OAuth state" }, 400);
    }
    pendingStates.delete(body.state);
  }

  // Exchange code for tokens with Google
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: body.code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: body.redirect_uri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("Google token exchange failed:", err);
    return c.json({ error: "token_exchange_failed", message: "Failed to authenticate with Google" }, 401);
  }

  const tokens = (await tokenRes.json()) as { id_token: string; access_token: string };

  // Fetch user info from Google
  const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userinfoRes.ok) {
    return c.json({ error: "userinfo_failed", message: "Failed to get user info" }, 401);
  }

  const userInfo = (await userinfoRes.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    hd?: string;
  };

  // Validate domain — only sahamati.org.in accounts allowed, plus an explicit allowlist
  const ALLOWED_DOMAIN = "sahamati.org.in";
  const EMAIL_ALLOWLIST = new Set(["gupta2022.tanya@gmail.com", "suyesh@gmail.com"]);
  if (userInfo.hd !== ALLOWED_DOMAIN && !EMAIL_ALLOWLIST.has(userInfo.email.toLowerCase())) {
    return c.json(
      { error: "domain_rejected", message: `Only @${ALLOWED_DOMAIN} accounts are allowed.` },
      403
    );
  }

  const userId = userInfo.sub;
  const email = userInfo.email;
  const name = userInfo.name ?? null;
  const pictureUrl = userInfo.picture ?? null;

  // Upsert user in D1
  await upsertUser(c.env.DB, { id: userId, email, name, pictureUrl });

  // Create session in KV
  const sessionId = nanoid(32);
  const sessionData: SessionData = {
    userId,
    email,
    name,
    pictureUrl,
    createdAt: Date.now(),
  };
  await createSession(c.env.SESSIONS, sessionId, sessionData);

  return c.json({
    user: { id: userId, email, name, pictureUrl },
    sessionId,
  });
});

// GET /auth/session — verify current session (called on app mount)
auth.get("/session", async (c) => {
  const authHeader = c.req.header("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) {
    return c.json({ authenticated: false }, 401);
  }

  const session = await getSession(c.env.SESSIONS, match[1]);
  if (!session) {
    return c.json({ authenticated: false }, 401);
  }

  return c.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      pictureUrl: session.pictureUrl,
    },
  });
});

// POST /auth/logout — destroy session
auth.post("/logout", async (c) => {
  const authHeader = c.req.header("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (match) {
    await deleteSession(c.env.SESSIONS, match[1]);
  }
  return c.json({ ok: true });
});

export default auth;
