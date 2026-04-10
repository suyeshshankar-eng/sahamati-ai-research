import { Hono } from "hono";
import type { Env, SessionData } from "./types";
import { createCorsMiddleware } from "./middleware/cors";
import { securityHeaders } from "./middleware/security";
import { authMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import documentRoutes from "./routes/documents";
import chatRoutes from "./routes/chat";
import healthRoutes from "./routes/health";

type AppEnv = { Bindings: Env; Variables: { userId: string; session: SessionData } };

const app = new Hono<AppEnv>();

// Global middleware
app.use("*", async (c, next) => {
  // Apply CORS with the configured frontend URL
  const corsHandler = createCorsMiddleware(c.env.FRONTEND_URL);
  return corsHandler(c, next);
});
app.use("*", securityHeaders);

// Public routes
app.route("/auth", authRoutes);
app.route("/health", healthRoutes);

// Protected routes
app.use("/documents/*", authMiddleware);
app.use("/chat/*", authMiddleware);
app.route("/documents", documentRoutes);
app.route("/chat", chatRoutes);

// 404 fallback
app.notFound((c) => c.json({ error: "not_found", message: "Route not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "internal_error", message: "Something went wrong" }, 500);
});

export default app;
