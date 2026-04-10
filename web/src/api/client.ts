const BASE = import.meta.env.VITE_API_URL ?? "";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  // Don't set Content-Type for FormData (browser sets multipart boundary)
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401 || res.status === 403) {
    if (!path.startsWith("/auth/")) {
      window.location.href = "/login";
    }
    throw new ApiError(res.status, "Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as any).message ?? res.statusText);
  }

  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---- Auth ----

export async function getClientId() {
  return apiFetch<{ client_id: string; state: string }>("/auth/client-id");
}

export async function exchangeToken(code: string, redirectUri: string, state: string) {
  return apiFetch<{ user: { id: string; email: string; name: string | null; pictureUrl: string | null } }>(
    "/auth/token",
    {
      method: "POST",
      body: JSON.stringify({ code, redirect_uri: redirectUri, state }),
    }
  );
}

export async function checkSession() {
  return apiFetch<{
    authenticated: boolean;
    user: { id: string; email: string; name: string | null; pictureUrl: string | null };
  }>("/auth/session");
}

export async function logout() {
  return apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

// ---- Documents ----

export async function uploadDocument(file: File, opts?: { category?: string; tags?: string[] }) {
  const formData = new FormData();
  formData.append("file", file);
  if (opts?.category) formData.append("category", opts.category);
  if (opts?.tags?.length) formData.append("tags", JSON.stringify(opts.tags));

  return apiFetch<{ document: any }>("/documents", {
    method: "POST",
    body: formData,
  });
}

export async function listDocuments() {
  return apiFetch<{
    documents: any[];
    categories: string[];
    allTags: string[];
    total: number;
  }>("/documents");
}

export async function updateDocumentMeta(id: string, meta: { category?: string | null; tags?: string[] | null }) {
  return apiFetch<{ ok: boolean }>(`/documents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(meta),
  });
}

export async function deleteDocument(id: string) {
  return apiFetch<{ ok: boolean }>(`/documents/${id}`, { method: "DELETE" });
}

// ---- Chat ----

export async function listConversations() {
  return apiFetch<{ conversations: any[] }>("/chat/conversations");
}

export async function deleteConversation(id: string) {
  return apiFetch<{ ok: boolean }>(`/chat/conversation/${id}`, { method: "DELETE" });
}

export async function linkDocumentToConversation(conversationId: string, documentId: string) {
  return apiFetch<{ ok: boolean }>(`/chat/conversation/${conversationId}/link-document`, {
    method: "POST",
    body: JSON.stringify({ documentId }),
  });
}

export async function sendMessage(
  message: string,
  opts?: { documentId?: string; conversationId?: string },
  onChunk?: (text: string) => void
): Promise<{ fullText: string; conversationId: string }> {
  const res = await fetch(`${BASE}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      documentId: opts?.documentId,
      conversationId: opts?.conversationId,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (body as any).message ?? "Chat request failed");
  }

  const returnedConvId = res.headers.get("X-Conversation-Id") ?? opts?.conversationId ?? "";
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) {
            fullText += parsed.text;
            onChunk?.(parsed.text);
          }
        } catch {}
      }
    }
  }

  return { fullText, conversationId: returnedConvId };
}

export async function getChatHistory(docId: string) {
  return apiFetch<{ conversations: any[] }>(`/chat/history/${docId}`);
}

export async function getConversationMessages(convId: string) {
  return apiFetch<{ conversation: any; messages: any[] }>(`/chat/conversation/${convId}`);
}
