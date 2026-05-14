import { useState, useCallback } from "react";
import { sendMessage, getConversationMessages, uploadDocument, linkDocumentToConversation } from "../api/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AttachedDoc {
  id: string;
  filename: string;
}

export function useChat(initialDocId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [documentId, setDocumentId] = useState<string | undefined>(initialDocId);
  const [attachedDoc, setAttachedDoc] = useState<AttachedDoc | null>(null);
  const [streaming, setStreaming] = useState(false);

  const loadConversation = useCallback(async (convId: string) => {
    const res = await getConversationMessages(convId);
    setConversationId(convId);
    setDocumentId(res.conversation.documentId ?? undefined);
    setMessages(
      res.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))
    );
  }, []);

  const attachDocument = useCallback(async (file: File) => {
    const res = await uploadDocument(file);
    const doc = res.document;
    setDocumentId(doc.id);
    setAttachedDoc({ id: doc.id, filename: doc.filename });

    // If conversation already exists, link the document to it
    if (conversationId) {
      await linkDocumentToConversation(conversationId, doc.id);
    }

    return doc;
  }, [conversationId]);

  const send = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text,
      };
      setMessages((prev) => [...prev, userMsg]);
      setStreaming(true);

      const assistantId = `temp-${Date.now()}-assistant`;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        const result = await sendMessage(
          text,
          { documentId, conversationId },
          (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + chunk } : m
              )
            );
          }
        );
        setConversationId(result.conversationId);
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Error: Failed to get response. Please try again." }
              : m
          )
        );
      } finally {
        setStreaming(false);
      }
    },
    [documentId, conversationId]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setDocumentId(undefined);
    setAttachedDoc(null);
  }, [initialDocId]);

  return {
    messages,
    streaming,
    conversationId,
    documentId,
    attachedDoc,
    send,
    loadConversation,
    attachDocument,
    reset,
  };
}
