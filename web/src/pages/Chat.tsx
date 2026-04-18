import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { Layout } from "../components/Layout";
import { ChatMessage } from "../components/ChatMessage";
import { ChatInput } from "../components/ChatInput";
import { useChat } from "../hooks/useChat";
import { listConversations, deleteConversation } from "../api/client";

interface ConversationItem {
  id: string;
  documentId: string | null;
  documentName: string | null;
  title: string;
  updatedAt: string;
}

export function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const docId = searchParams.get("doc") ?? undefined;

  const {
    messages,
    streaming,
    conversationId,
    documentId,
    attachedDoc,
    send,
    loadConversation,
    attachDocument,
    reset,
  } = useChat(docId);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refreshConversations = useCallback(() => {
    listConversations().then((res) => setConversations(res.conversations));
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    reset();
    setSearchParams({});
  };

  const handleSelectConversation = async (conv: ConversationItem) => {
    await loadConversation(conv.id);
    if (conv.documentId) {
      setSearchParams({ doc: conv.documentId });
    } else {
      setSearchParams({});
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    await deleteConversation(convId);
    if (conversationId === convId) {
      reset();
      setSearchParams({});
    }
    refreshConversations();
  };

  const handleAttachFile = async (file: File) => {
    const doc = await attachDocument(file);
    setSearchParams({ doc: doc.id });
  };

  // Group conversations by date
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  const grouped: { label: string; items: ConversationItem[] }[] = [];
  const groups: Record<string, ConversationItem[]> = {};

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt).toDateString();
    let label: string;
    if (date === today) label = "Today";
    else if (date === yesterday) label = "Yesterday";
    else label = new Date(conv.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    if (!groups[label]) {
      groups[label] = [];
      grouped.push({ label, items: groups[label] });
    }
    groups[label].push(conv);
  }

  // Determine the attached document name to show
  const currentDocName =
    attachedDoc?.filename ??
    conversations.find((c) => c.id === conversationId)?.documentName ??
    null;

  return (
    <Layout>
      <div className="flex h-[calc(100vh-5rem)]">
        {/* Sidebar */}
        <div
          className={`${
            sidebarOpen ? "w-64" : "w-0"
          } flex-shrink-0 transition-all duration-200 overflow-hidden`}
        >
          <div className="w-64 h-full flex flex-col border-r border-gray-200 bg-white">
            <div className="p-3 border-b border-gray-100">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + New chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {grouped.map((group) => (
                <div key={group.label} className="mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase px-2 mb-1">
                    {group.label}
                  </p>
                  {group.items.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-sm ${
                        conversationId === conv.id
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{conv.title || "Untitled"}</p>
                        {conv.documentName && (
                          <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {conv.documentName}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => handleDeleteConversation(e, conv.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs flex-shrink-0"
                        title="Delete"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              {conversations.length === 0 && (
                <p className="text-gray-400 text-xs text-center py-8">
                  No conversations yet
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 bg-white">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-gray-600 text-sm"
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {"\u2630"}
            </button>
            {(documentId || currentDocName) && (
              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
                {currentDocName ?? "Document attached"}
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <p className="text-lg font-medium mb-1">AI Research Assistant</p>
                <p className="text-sm mb-3">Ask anything, or attach a document to analyze</p>
                <p className="text-xs">Use the paperclip icon below to upload a file</p>
              </div>
            )}
            <div className="max-w-3xl mx-auto">
              {messages.map((msg) => (
                <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white px-4 py-3">
            <div className="max-w-3xl mx-auto">

              {/* Suggestion chips */}
              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {(documentId ? [
                    "Summarise this document",
                    "What are the key points?",
                    "List the main topics",
                    "What conclusions does it draw?",
                  ] : [
                    "What can you help me with?",
                    "Explain a concept to me",
                    "Help me analyse something",
                    "Summarise a topic",
                  ]).map((chip) => (
                    <button
                      key={chip}
                      onClick={() => send(chip)}
                      className="px-3 py-1.5 rounded-full border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors bg-white"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              <ChatInput
                onSend={send}
                onAttachFile={handleAttachFile}
                disabled={streaming}
                attachedFilename={currentDocName}
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
