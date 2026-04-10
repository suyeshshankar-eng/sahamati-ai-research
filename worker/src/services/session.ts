import type { SessionData } from "../types";

const SESSION_TTL = 60 * 60 * 24; // 24 hours

export async function createSession(
  kv: KVNamespace,
  sessionId: string,
  data: SessionData
): Promise<void> {
  await kv.put(sessionId, JSON.stringify(data), { expirationTtl: SESSION_TTL });
}

export async function getSession(
  kv: KVNamespace,
  sessionId: string
): Promise<SessionData | null> {
  const raw = await kv.get(sessionId);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function deleteSession(kv: KVNamespace, sessionId: string): Promise<void> {
  await kv.delete(sessionId);
}
