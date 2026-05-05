import { GoogleGenAI } from "@google/genai";

export function createGeminiClient(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

export interface DocumentInput {
  type: "text" | "pdf" | "image";
  content: string; // text content OR base64 data
  mimeType?: string;
}

//updated - send document or text based on content length and ratio of whitespaces
export async function streamChat(
  client: GoogleGenAI,
  document: DocumentInput | null,
  conversationHistory: { role: string; content: string }[],
  userMessage: string
): Promise<{ stream: ReadableStream; getFullResponse: () => Promise<string> }> {
  // Build user message parts
  const userParts: any[] = [];
  
  // Add document as inline data if PDF or image
  if (document?.type === "pdf" || document?.type === "image") {
    userParts.push({
      inlineData: {
        mimeType: document.mimeType,
        data: document.content, // base64
      }
    });
  }

  userParts.push({ text: userMessage });

  const contents = [
    ...conversationHistory.map((msg) => ({
      role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: msg.content }],
    })),
    { role: "user" as const, parts: userParts },
  ];

  const systemInstruction = document?.type === "text"
    ? `You are a document research assistant. Analyze the following document and answer the user's questions about it. Be thorough, accurate, and cite specific parts of the document when relevant.

  DOCUMENT CONTENT:
${document.content}`
    : document?.type === "pdf" || document?.type === "image"
    ? `You are a document research assistant. Analyze the provided document and answer the user's questions about it. Be thorough, accurate, and cite specific parts when relevant.`
    : `You are a helpful research and analysis assistant. Help the user with their questions. Be thorough, accurate, and well-structured in your responses.`;
  
    const response = await client.models.generateContentStream({
    model: "gemini-2.5-flash",
    config: { systemInstruction },
    contents,
  });

  const encoder = new TextEncoder();
  let fullResponse = "";
  let resolveFullResponse: (value: string) => void;
  const fullResponsePromise = new Promise<string>((resolve) => {
    resolveFullResponse = resolve;
  });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of response) {
          const text = chunk.text ?? "";
          if (text) {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        resolveFullResponse!(fullResponse);
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
          )
        );
        controller.close();
        resolveFullResponse!(fullResponse);
      }
    },
  });

  return { stream, getFullResponse: () => fullResponsePromise };
}

// Original - Sending extracted text

// export async function streamChat(
//   client: GoogleGenAI,
//   documentText: string | null,
//   conversationHistory: { role: string; content: string }[],
//   userMessage: string
// ): Promise<{ stream: ReadableStream; getFullResponse: () => Promise<string> }> {
//   const contents = [
//     ...conversationHistory.map((msg) => ({
//       role: msg.role === "assistant" ? ("model" as const) : ("user" as const),
//       parts: [{ text: msg.content }],
//     })),
//     { role: "user" as const, parts: [{ text: userMessage }] },
//   ];

//   const systemInstruction = documentText
//     ? `You are a document research assistant. Analyze the following document and answer the user's questions about it. Be thorough, accurate, and cite specific parts of the document when relevant.

// DOCUMENT CONTENT:
// ${documentText}`
//     : `You are a helpful research and analysis assistant. Help the user with their questions. Be thorough, accurate, and well-structured in your responses.`;

//   console.error("GEMINI INPUT:", JSON.stringify({
//     documentTextPreview: documentText ? documentText.slice(0, 500) : "NO DOCUMENT",
//     documentTextLength: documentText?.length ?? 0,
//     lastMessage: userMessage
//   }));
  
//     const response = await client.models.generateContentStream({
//     model: "gemini-2.5-flash",
//     config: { systemInstruction },
//     contents,
//   });

//   const encoder = new TextEncoder();
//   let fullResponse = "";
//   let resolveFullResponse: (value: string) => void;
//   const fullResponsePromise = new Promise<string>((resolve) => {
//     resolveFullResponse = resolve;
//   });

//   const stream = new ReadableStream({
//     async start(controller) {
//       try {
//         for await (const chunk of response) {
//           const text = chunk.text ?? "";
//           if (text) {
//             fullResponse += text;
//             controller.enqueue(
//               encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
//             );
//           }
//         }
//         controller.enqueue(encoder.encode("data: [DONE]\n\n"));
//         controller.close();
//         resolveFullResponse!(fullResponse);
//       } catch (err) {
//         controller.enqueue(
//           encoder.encode(
//             `data: ${JSON.stringify({ error: "Stream error" })}\n\n`
//           )
//         );
//         controller.close();
//         resolveFullResponse!(fullResponse);
//       }
//     },
//   });

//   return { stream, getFullResponse: () => fullResponsePromise };
// }

export async function summarizeDocument(
  client: GoogleGenAI,
  documentText: string
): Promise<string> {
    const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [{ text: `Summarize the following document in 2-3 sentences. Be concise and capture the main points.\n\nDOCUMENT:\n${documentText}` }],
      },
    ],
  });

  return response.text ?? "";
}