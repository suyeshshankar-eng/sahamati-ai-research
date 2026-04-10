import { cors } from "hono/cors";
import type { Env } from "../types";

export function createCorsMiddleware(frontendUrl: string) {
  return cors({
    origin: frontendUrl,
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    credentials: true,
    maxAge: 86400,
  });
}
