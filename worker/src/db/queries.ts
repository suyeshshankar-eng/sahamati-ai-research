import type { Env } from "../types";

// ---- Users ----

export async function upsertUser(
  db: D1Database,
  user: { id: string; email: string; name: string | null; pictureUrl: string | null }
) {
  await db
    .prepare(
      `INSERT INTO users (id, email, name, picture_url)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture_url = excluded.picture_url,
         updated_at = datetime('now')`
    )
    .bind(user.id, user.email, user.name, user.pictureUrl)
    .run();
}

export async function getUser(db: D1Database, userId: string) {
  return db.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first();
}

// ---- Documents ----

export async function insertDocument(
  db: D1Database,
  doc: {
    id: string;
    userId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    r2KeyOriginal: string;
    r2KeyText: string | null;
    isImage: boolean;
    category: string | null;
    tags: string[] | null;
    summary: string | null; 
  }
) {
  await db
    .prepare(
      `INSERT INTO documents (id, user_id, filename, mime_type, size_bytes, r2_key_original, r2_key_text, is_image, category, tags, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      doc.id,
      doc.userId,
      doc.filename,
      doc.mimeType,
      doc.sizeBytes,
      doc.r2KeyOriginal,
      doc.r2KeyText,
      doc.isImage ? 1 : 0,
      doc.category,
      doc.tags ? JSON.stringify(doc.tags) : null,
      doc.summary ?? null
    )
    .run();
}

export async function listDocuments(db: D1Database, userId: string) {
  return db
    .prepare(
      "SELECT id, filename, mime_type, size_bytes, is_image, category, tags, created_at, summary FROM documents WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(userId)
    .all();
}

export async function updateDocumentMeta(
  db: D1Database,
  docId: string,
  userId: string,
  meta: { category?: string | null; tags?: string[] | null }
) {
  const sets: string[] = [];
  const binds: any[] = [];

  if (meta.category !== undefined) {
    sets.push("category = ?");
    binds.push(meta.category);
  }
  if (meta.tags !== undefined) {
    sets.push("tags = ?");
    binds.push(meta.tags ? JSON.stringify(meta.tags) : null);
  }

  if (sets.length === 0) return;

  binds.push(docId, userId);
  await db
    .prepare(`UPDATE documents SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
    .bind(...binds)
    .run();
}

export async function getDocument(db: D1Database, docId: string, userId: string) {
  return db
    .prepare("SELECT * FROM documents WHERE id = ? AND user_id = ?")
    .bind(docId, userId)
    .first();
}

export async function deleteDocument(db: D1Database, docId: string, userId: string) {
  await db.prepare("DELETE FROM documents WHERE id = ? AND user_id = ?").bind(docId, userId).run();
}

// ---- Conversations ----

export async function createConversation(
  db: D1Database,
  conv: { id: string; userId: string; documentId: string | null; title: string | null }
) {
  await db
    .prepare(
      "INSERT INTO conversations (id, user_id, document_id, title) VALUES (?, ?, ?, ?)"
    )
    .bind(conv.id, conv.userId, conv.documentId, conv.title)
    .run();
}

export async function listConversationsByDocument(db: D1Database, documentId: string, userId: string) {
  return db
    .prepare(
      "SELECT id, document_id, title, created_at, updated_at FROM conversations WHERE document_id = ? AND user_id = ? ORDER BY updated_at DESC"
    )
    .bind(documentId, userId)
    .all();
}

export async function listAllConversations(db: D1Database, userId: string) {
  return db
    .prepare(
      `SELECT c.id, c.document_id, c.title, c.created_at, c.updated_at, d.filename as document_name
       FROM conversations c
       LEFT JOIN documents d ON c.document_id = d.id
       WHERE c.user_id = ?
       ORDER BY c.updated_at DESC
       LIMIT 50`
    )
    .bind(userId)
    .all();
}

export async function linkDocumentToConversation(db: D1Database, convId: string, userId: string, documentId: string) {
  await db
    .prepare("UPDATE conversations SET document_id = ? WHERE id = ? AND user_id = ?")
    .bind(documentId, convId, userId)
    .run();
}

export async function deleteConversation(db: D1Database, convId: string, userId: string) {
  await db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").bind(convId, userId).run();
}

export async function getConversation(db: D1Database, convId: string, userId: string) {
  return db
    .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
    .bind(convId, userId)
    .first();
}

export async function updateConversationTimestamp(db: D1Database, convId: string) {
  await db
    .prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?")
    .bind(convId)
    .run();
}

// ---- Messages ----

export async function insertMessage(
  db: D1Database,
  msg: { id: string; conversationId: string; role: string; content: string }
) {
  await db
    .prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)")
    .bind(msg.id, msg.conversationId, msg.role, msg.content)
    .run();
}

export async function getMessages(db: D1Database, conversationId: string) {
  return db
    .prepare(
      "SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
    )
    .bind(conversationId)
    .all();
}
