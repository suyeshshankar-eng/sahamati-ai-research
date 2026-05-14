import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { Layout } from "../components/Layout";
import { ChatMessage } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import { useChat } from "../hooks/useChat";
import { getChatHistory, getDocumentText } from "../api/client";

export function Research() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const { messages, streaming, conversationId, send, loadConversation, reset } =
    useChat(docId!);
  const [conversations, setConversations] = useState<any[]>([]);
  const [docText, setDocText]  = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (docId) {
      getChatHistory(docId).then((res) => setConversations(res.conversations));
    }
  }, [docId, conversationId]);

  useEffect(() => {
    if (!docId) return;

    getDocumentText(docId)
      .then((res) => setDocText(res.text))
      .catch(() => setDocText(null));
  }, [docId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Layout>
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        {/* Sidebar: conversations */}
        <div className="w-56 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => navigate("/")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Back
            </button>
            <button
              onClick={reset}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              New chat
            </button>
          </div>
          <div className="space-y-1">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left text-sm px-3 py-2 rounded-lg truncate ${
                  conversationId === conv.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {conv.title ?? "Untitled"}
              </button>
            ))}
          </div>
        </div>

        {/* Document Text Panel - only visible if text exists */}
        {docText && (
          <div className="w-96 flex-shrink-0 flex flex-col bg-white rounded-lg border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Document</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {docText}
              </p>
            </div>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Ask a question about your document to get started
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage key={msg.id} id = {msg.id} role={msg.role} content={msg.content} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-gray-200">
            <ChatInput onSend={send} disabled={streaming} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
