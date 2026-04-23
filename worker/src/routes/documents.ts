import { Hono } from "hono";
import type { Env, SessionData } from "../types";
import { nanoid } from "nanoid";
import { deriveUserKey, encrypt, decrypt } from "../services/crypto";
import {
  insertDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  updateDocumentMeta,
} from "../db/queries";
import { extractPdfText } from "../parsers/pdf";
import { extractDocxText } from "../parsers/docx";
import { extractSpreadsheetText } from "../parsers/spreadsheet";
import { extractPlainText } from "../parsers/text";
import { summarizeDocument } from "../services/gemini";
import { GoogleGenAI } from "@google/genai";

type DocsApp = { Bindings: Env; Variables: { userId: string; session: SessionData } };

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

const documents = new Hono<DocsApp>();

async function extractText(
  buffer: ArrayBuffer,
  mimeType: string
): Promise<string | null> {
  if (IMAGE_TYPES.has(mimeType)) return null;

  if (mimeType === "application/pdf") return extractPdfText(buffer);
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  )
    return extractDocxText(buffer);
  if (
    mimeType === "text/csv" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  )
    return extractSpreadsheetText(buffer);
  if (mimeType.startsWith("text/")) return extractPlainText(buffer);

  return extractPlainText(buffer);
}

// POST /documents - Upload document
documents.post("/", async (c) => {
  const userId = c.get("userId");
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string | null) || null;
  const tagsRaw = formData.get("tags") as string | null;
  const tags = tagsRaw ? JSON.parse(tagsRaw) as string[] : null;

  if (!file) {
    return c.json({ error: "missing_file", message: "No file provided" }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "file_too_large", message: "File exceeds 25MB limit" }, 400);
  }

  const docId = nanoid();
  const buffer = await file.arrayBuffer();
  const isImage = IMAGE_TYPES.has(file.type);

  const key = await deriveUserKey(c.env.ENCRYPTION_MASTER_KEY, userId);

  const encryptedOriginal = await encrypt(buffer, key);
  const r2KeyOriginal = `${userId}/${docId}/original`;
  await c.env.DOCUMENTS_BUCKET.put(r2KeyOriginal, encryptedOriginal);

  let r2KeyText: string | null = null;
  let summary: string | null = null;
  if (!isImage) {
    const text = await extractText(buffer, file.type);
    if (text) {
      const textBytes = new TextEncoder().encode(text);
      const encryptedText = await encrypt(textBytes.buffer as ArrayBuffer, key);
      r2KeyText = `${userId}/${docId}/text`;
      await c.env.DOCUMENTS_BUCKET.put(r2KeyText, encryptedText);
      try {
        const genAI = new GoogleGenAI({ apiKey: c.env.GEMINI_API_KEY });
        summary = await summarizeDocument(genAI, text);
      } catch {
        // silently fail — summary is optional
      }
    }
  }

  await insertDocument(c.env.DB, {
    id: docId,
    userId,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    r2KeyOriginal,
    r2KeyText,
    isImage,
    category,
    tags,
    summary,
  });

  return c.json(
    {
      document: {
        id: docId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        isImage,
        category,
        tags: tags ?? [],
        createdAt: new Date().toISOString(),
      },
    },
    201
  );
});

// GET /documents - List user's documents with categories and tags
documents.get("/", async (c) => {
  const userId = c.get("userId");
  const result = await listDocuments(c.env.DB, userId);

  const categoriesSet = new Set<string>();
  const tagsSet = new Set<string>();

  const docs = result.results.map((row: any) => {
    const category = row.category ?? null;
    const tags: string[] = row.tags ? JSON.parse(row.tags) : [];
    if (category) categoriesSet.add(category);
    tags.forEach((t: string) => tagsSet.add(t));
    return {
      id: row.id,
      filename: row.filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      isImage: row.is_image === 1,
      category,
      tags,
      createdAt: row.created_at,
      summary: row.summary
    };
  });

  return c.json({
    documents: docs,
    categories: [...categoriesSet].sort(),
    allTags: [...tagsSet].sort(),
    total: docs.length,
  });
});

// PATCH /documents/:id - Update document category and/or tags
documents.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const docId = c.req.param("id");
  const body = await c.req.json<{ category?: string | null; tags?: string[] | null }>();

  const doc = await getDocument(c.env.DB, docId, userId);
  if (!doc) {
    return c.json({ error: "not_found", message: "Document not found" }, 404);
  }

  const meta: { category?: string | null; tags?: string[] | null } = {};
  if (body.category !== undefined) meta.category = body.category?.trim() || null;
  if (body.tags !== undefined) meta.tags = body.tags?.map((t) => t.trim()).filter(Boolean) ?? null;

  await updateDocumentMeta(c.env.DB, docId, userId, meta);

  return c.json({ ok: true, ...meta });
});

// DELETE /documents/:id - Delete document
documents.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const docId = c.req.param("id");

  const doc = await getDocument(c.env.DB, docId, userId);
  if (!doc) {
    return c.json({ error: "not_found", message: "Document not found" }, 404);
  }

  await c.env.DOCUMENTS_BUCKET.delete((doc as any).r2_key_original);
  if ((doc as any).r2_key_text) {
    await c.env.DOCUMENTS_BUCKET.delete((doc as any).r2_key_text);
  }

  await deleteDocument(c.env.DB, docId, userId);

  return c.json({ ok: true });
});

// GET /documents/:id/text - Get decrypted document text for Research page
documents.get("/:id/text", async (c) =>{
  const userId = c.get("userId")
  const docId = c.req.param("id");

  const doc = await getDocument(c.env.DB, docId, userId);
  if (!doc) {
    return c.json({ error: "not_found", message: "Document not found" }, 404);
  }

  if (!(doc as any).r2_key_text) {
    return c.json({ error: "no_text", message: "No text available for this document" }, 404);
  }

  const encrypted = await c.env.DOCUMENTS_BUCKET.get((doc as any).r2_key_text);
  if (!encrypted) {
    return c.json({ error: "not_found", message: "File not found in storage" }, 404);
  }

  const key = await deriveUserKey(c.env.ENCRYPTION_MASTER_KEY, userId);
  const decrypted = await decrypt(await encrypted.arrayBuffer(), key);
  const text = new TextDecoder().decode(decrypted);

  return c.json({ text });
})

export default documents;
