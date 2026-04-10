export interface Env {
  DOCUMENTS_BUCKET: R2Bucket;
  DB: D1Database;
  SESSIONS: KVNamespace;
  GEMINI_API_KEY: string;
  ENCRYPTION_MASTER_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  FRONTEND_URL: string;
}

export interface SessionData {
  userId: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  createdAt: number;
}
