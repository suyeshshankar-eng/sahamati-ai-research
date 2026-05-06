import { Hono } from "hono";
import type { Env, SessionData } from "../types";
import { nanoid } from "nanoid";
import { deriveUserKey, decrypt } from "../services/crypto";
import { createGeminiClient, streamChat } from "../services/gemini";
import {
  getDocument,
  createConversation,
  getConversation,
  listConversationsByDocument,
  listAllConversations,
  getMessages,
  insertMessage,
  updateConversationTimestamp,
  linkDocumentToConversation,
  deleteConversation,
} from "../db/queries";

type ChatApp = { Bindings: Env; Variables: { userId: string; session: SessionData } };

const chat = new Hono<ChatApp>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

// POST /chat - Send message and stream response
chat.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    documentId?: string;
    conversationId?: string;
    message: string;
  }>();

  if (!body.message) {
    return c.json({ error: "bad_request", message: "message is required" }, 400);
  }

  let documentInput: { type: "text" | "pdf" | "image"; content: string; mimeType?: string } | null = null;
  
  if (body.documentId) {
      const doc = await getDocument(c.env.DB, body.documentId, userId);
      if (!doc) {
        return c.json({ error: "not_found", message: "Document not found" }, 404);
      }

      const key = await deriveUserKey(c.env.ENCRYPTION_MASTER_KEY, userId);
      const mimeType = (doc as any).mime_type;

      if ((doc as any).is_image === 1) {
        // Fetch and decrypt original image from R2
        const r2Object = await c.env.DOCUMENTS_BUCKET.get((doc as any).r2_key_original);
        if (r2Object) {
          const encryptedData = await r2Object.arrayBuffer();
          const decryptedData = await decrypt(encryptedData, key);
          const base64 = btoa(String.fromCharCode(...new Uint8Array(decryptedData)));
          documentInput = { type: "image", content: base64, mimeType };
        }
      } else if (mimeType === "application/pdf") {
        // Fetch and decrypt original PDF from R2 — send directly to Gemini
        const r2Object = await c.env.DOCUMENTS_BUCKET.get((doc as any).r2_key_original);
        if (r2Object) {
          const encryptedData = await r2Object.arrayBuffer();
          const decryptedData = await decrypt(encryptedData, key);
          const base64 = arrayBufferToBase64(decryptedData);
          documentInput = { type: "pdf", content: base64, mimeType: "application/pdf" };
        }
      } 
      else if ((doc as any).r2_key_text) {
        // For other file types (docx, csv, txt) — use extracted text as before
        const r2Object = await c.env.DOCUMENTS_BUCKET.get((doc as any).r2_key_text);
        if (r2Object) {
          const encryptedText = await r2Object.arrayBuffer();
          const decryptedText = await decrypt(encryptedText, key);
          documentInput = { type: "text", content: new TextDecoder().decode(decryptedText) };
        }
      }
    }

  // Get or create conversation
  let conversationId = body.conversationId;
  if (conversationId) {
    const conv = await getConversation(c.env.DB, conversationId, userId);
    if (!conv) {
      return c.json({ error: "not_found", message: "Conversation not found" }, 404);
    }
  } else {
    conversationId = nanoid();
    await createConversation(c.env.DB, {
      id: conversationId,
      userId,
      documentId: body.documentId ?? null,
      title: body.message.slice(0, 100),
    });
  }

  // Load conversation history
  const historyResult = await getMessages(c.env.DB, conversationId);
  const conversationHistory = historyResult.results.map((msg: any) => ({
    role: msg.role as string,
    content: msg.content as string,
  }));

  // Save user message
  await insertMessage(c.env.DB, {
    id: nanoid(),
    conversationId,
    role: "user",
    content: body.message,
  });

  // Stream Gemini response
  const gemini = createGeminiClient(c.env.GEMINI_API_KEY);
  const { stream, getFullResponse } = await streamChat(
    gemini,
    // documentText,
    documentInput,
    conversationHistory,
    body.message
  );

  // Save assistant response after stream completes (in background)
  c.executionCtx.waitUntil(
    getFullResponse().then(async (fullResponse) => {
      await insertMessage(c.env.DB, {
        id: nanoid(),
        conversationId: conversationId!,
        role: "assistant",
        content: fullResponse,
      });
      await updateConversationTimestamp(c.env.DB, conversationId!);
    })
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Conversation-Id": conversationId,
    },
  });
});

// POST /chat/conversation/:id/link-document - Link a document to an existing conversation
chat.post("/conversation/:id/link-document", async (c) => {
  const userId = c.get("userId");
  const convId = c.req.param("id");
  const body = await c.req.json<{ documentId: string }>();

  if (!body.documentId) {
    return c.json({ error: "bad_request", message: "documentId required" }, 400);
  }

  const conv = await getConversation(c.env.DB, convId, userId);
  if (!conv) {
    return c.json({ error: "not_found", message: "Conversation not found" }, 404);
  }

  const doc = await getDocument(c.env.DB, body.documentId, userId);
  if (!doc) {
    return c.json({ error: "not_found", message: "Document not found" }, 404);
  }

  await linkDocumentToConversation(c.env.DB, convId, userId, body.documentId);
  return c.json({ ok: true, documentId: body.documentId });
});

// GET /chat/conversations - List all conversations for the user
chat.get("/conversations", async (c) => {
  const userId = c.get("userId");
  const result = await listAllConversations(c.env.DB, userId);

  const conversations = result.results.map((row: any) => ({
    id: row.id,
    documentId: row.document_id,
    documentName: row.document_name ?? null,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return c.json({ conversations });
});

// GET /chat/history/:docId - List conversations for a document
chat.get("/history/:docId", async (c) => {
  const userId = c.get("userId");
  const docId = c.req.param("docId");

  const doc = await getDocument(c.env.DB, docId, userId);
  if (!doc) {
    return c.json({ error: "not_found", message: "Document not found" }, 404);
  }

  const result = await listConversationsByDocument(c.env.DB, docId, userId);
  const conversations = result.results.map((row: any) => ({
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return c.json({ conversations });
});

// GET /chat/conversation/:id - Get messages in a conversation
chat.get("/conversation/:id", async (c) => {
  const userId = c.get("userId");
  const convId = c.req.param("id");

  const conv = await getConversation(c.env.DB, convId, userId);
  if (!conv) {
    return c.json({ error: "not_found", message: "Conversation not found" }, 404);
  }

  const messagesResult = await getMessages(c.env.DB, convId);
  const messages = messagesResult.results.map((msg: any) => ({
    id: msg.id,
    role: msg.role,
    content: msg.content,
    createdAt: msg.created_at,
  }));

  return c.json({
    conversation: {
      id: (conv as any).id,
      documentId: (conv as any).document_id,
      title: (conv as any).title,
      createdAt: (conv as any).created_at,
      updatedAt: (conv as any).updated_at,
    },
    messages,
  });
});

// DELETE /chat/conversation/:id - Delete a conversation
chat.delete("/conversation/:id", async (c) => {
  const userId = c.get("userId");
  const convId = c.req.param("id");

  const conv = await getConversation(c.env.DB, convId, userId);
  if (!conv) {
    return c.json({ error: "not_found", message: "Conversation not found" }, 404);
  }

  await deleteConversation(c.env.DB, convId, userId);
  return c.json({ ok: true });
});

export default chat;
