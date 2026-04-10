import { createMiddleware } from "hono/factory";
import type { Env } from "../types";

export const securityHeaders = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self'; connect-src 'self' ${c.env.FRONTEND_URL}; img-src 'self' https://lh3.googleusercontent.com; style-src 'self' 'unsafe-inline'`
  );
});
