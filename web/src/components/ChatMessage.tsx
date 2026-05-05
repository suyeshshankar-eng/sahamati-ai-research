import Markdown from "react-markdown";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
  id: string;
}

export function ChatMessage({ role, content , id}: Props) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    //Get the rendered text from the DOM element
    const element = document.getElementById(`msg-${id}`);
    const text = element?.innerText ?? content;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000)
  };

  return (
    <div className={`flex flex-col mb-4 group ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white border border-gray-200 text-gray-900"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div id={`msg-${id}`} className="prose prose-sm max-w-none">
            <Markdown>{content || "..."}</Markdown>
          </div>
        )}
      </div>
      {/* Copy button */}
      {!isUser && (
        <button
          onClick={handleCopy}
          className="self-end mb-1 ml-2 p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 self-start"
          title="Copy"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
  );
}
