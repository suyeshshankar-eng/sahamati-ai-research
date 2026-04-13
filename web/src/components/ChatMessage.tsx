import Markdown from "react-markdown";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content); //copies message text to clipboard
    setCopied(true); //copied state — tracks if copy was clicked
    setTimeout(() => setCopied(false), 2000) //shows "Copied" for 2 seconds then resets back to "Copy"
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 group ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-white border border-gray-200 text-gray-900"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
        <>
          <div className="prose prose-sm max-w-none">
            <Markdown>{content || "..."}</Markdown>
          </div>
          {/* copy button */}
          <button
            onClick={handleCopy}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className = "mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors opacity-0 group-hover:opacity-100"
            title = "Copy"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
