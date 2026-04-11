# Local Setup

Guide for coding agents (and humans) working on this repo.

## Stack
- **web/** — React 19 + Vite + Tailwind 4
- **worker/** — Cloudflare Workers + Hono, bound to D1 (SQLite), R2 (blob), KV (sessions)
- **shared/** — shared TypeScript types
- npm workspaces (root [package.json](package.json))

## Prerequisites
- Node 20+ and npm 10+
- A Cloudflare account (for D1/R2/KV) — free tier is fine
- `wrangler` CLI is installed via the worker workspace; use `npx wrangler ...`

## Install
```bash
npm install
```
Installs all three workspaces in one go. Do **not** use yarn — the lockfile is `package-lock.json`.

## Secrets

### Worker (`worker/.dev.vars`)
Create this file (gitignored). Required keys — listed as comments in [worker/wrangler.jsonc](worker/wrangler.jsonc):
```
GEMINI_API_KEY=...
ENCRYPTION_MASTER_KEY=...   # 32-byte base64; generate: openssl rand -base64 32
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
FRONTEND_URL=http://localhost:5173
```

### Web (`web/.env.local`)
```
VITE_API_URL=http://localhost:8787
```
[web/.env.production](web/.env.production) already points at the deployed worker — leave it alone.

## Cloudflare resources
The IDs in [worker/wrangler.jsonc](worker/wrangler.jsonc) point at the maintainer's Cloudflare account. To run against your own:
```bash
npx wrangler d1 create ai-ui-db
npx wrangler r2 bucket create ai-ui-documents
npx wrangler kv namespace create SESSIONS
```
Paste the new IDs into `wrangler.jsonc`, then apply the schema:
```bash
npm run db:migrate --workspace=worker     # local D1
npx wrangler d1 execute ai-ui-db --file=worker/src/db/schema.sql --remote   # remote D1
```

## Run
Two terminals:
```bash
npm run dev:worker   # http://localhost:8787
npm run dev:web      # http://localhost:5173
```

## Deploy
```bash
npm run deploy:worker
npm run build:web    # output in web/dist
```
Set worker secrets in production with `npx wrangler secret put <NAME>` (do not commit `.dev.vars`).

## Code map
- Upload: [DocumentUpload.tsx](web/src/components/DocumentUpload.tsx) → [useDocuments.ts](web/src/hooks/useDocuments.ts) → [routes/documents.ts](worker/src/routes/documents.ts) → parsers + [crypto.ts](worker/src/services/crypto.ts) → R2 + D1
- Chat (SSE): [ChatInput.tsx](web/src/components/ChatInput.tsx) → [useChat.ts](web/src/hooks/useChat.ts) → [routes/chat.ts](worker/src/routes/chat.ts) → [gemini.ts](worker/src/services/gemini.ts)
- Auth: [Login.tsx](web/src/pages/Login.tsx) → [AuthContext.tsx](web/src/context/AuthContext.tsx) → [routes/auth.ts](worker/src/routes/auth.ts) → [session.ts](worker/src/services/session.ts) (KV)
- Schema: [schema.sql](worker/src/db/schema.sql); all SQL in [queries.ts](worker/src/db/queries.ts)

## Gotchas
- Encryption is per-user AES-256-GCM; rotating `ENCRYPTION_MASTER_KEY` invalidates every stored document.
- [Research.tsx](web/src/pages/Research.tsx) exists but isn't routed in [App.tsx](web/src/App.tsx) — known.
- Sidebar conversation list is hardcoded `LIMIT 50` in [queries.ts](worker/src/db/queries.ts) — known.
- Image uploads currently send a placeholder string to Gemini, not the actual image — see [gemini.ts](worker/src/services/gemini.ts).
- No tests exist yet.
