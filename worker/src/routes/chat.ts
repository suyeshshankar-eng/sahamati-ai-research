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

  // If a document is referenced, verify it belongs to user
  let documentText: string | null = null;
  if (body.documentId) {
    const doc = await getDocument(c.env.DB, body.documentId, userId);
    if (!doc) {
      return c.json({ error: "not_found", message: "Document not found" }, 404);
    }

    // Decrypt document text
    const key = await deriveUserKey(c.env.ENCRYPTION_MASTER_KEY, userId);
    if ((doc as any).r2_key_text) {
      const r2Object = await c.env.DOCUMENTS_BUCKET.get((doc as any).r2_key_text);
      if (r2Object) {
        const encryptedText = await r2Object.arrayBuffer();
        const decryptedText = await decrypt(encryptedText, key);
        documentText = new TextDecoder().decode(decryptedText);
      }
    } else if ((doc as any).is_image === 1) {
      documentText = "[This is an image document. Describe what you see and answer questions about it.]";
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
    documentText,
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
