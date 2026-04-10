// ---- User ----
export interface User {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  createdAt: string;
}

// ---- Documents ----
export interface Document {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
  createdAt: string;
}

export interface UploadDocumentResponse {
  document: Document;
}

export interface ListDocumentsResponse {
  documents: Document[];
}

// ---- Chat ----
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  documentId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  documentId: string;
  conversationId?: string;
  message: string;
}

export interface ChatHistoryResponse {
  conversations: Conversation[];
}

export interface ConversationMessagesResponse {
  conversation: Conversation;
  messages: Message[];
}

// ---- Auth ----
export interface AuthMeResponse {
  user: User;
}

// ---- Errors ----
export interface ApiError {
  error: string;
  message: string;
}
