import { createMiddleware } from "hono/factory";
import type { Env, SessionData } from "../types";
import { getSession } from "../services/session";

type AuthEnv = {
  Bindings: Env;
  Variables: { userId: string; session: SessionData };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const cookie = c.req.header("Cookie") ?? "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) {
    return c.json({ error: "unauthorized", message: "No session" }, 401);
  }

  const sessionId = match[1];
  const session = await getSession(c.env.SESSIONS, sessionId);
  if (!session) {
    return c.json({ error: "unauthorized", message: "Invalid session" }, 401);
  }

  c.set("userId", session.userId);
  c.set("session", session);
  await next();
});
