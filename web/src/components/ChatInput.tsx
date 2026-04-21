import { useState, useRef, type FormEvent } from "react";

interface Props {
  onSend: (message: string) => void;
  onAttachFile?: (file: File) => Promise<void>;
  disabled?: boolean;
  attachedFilename?: string | null;
}

export function ChatInput({ onSend, onAttachFile, disabled, attachedFilename }: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAttachFile) return;
    setUploading(true);
    try {
      await onAttachFile(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) =>{
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <div>
      {attachedFilename && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {attachedFilename}
          </span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 items-end">
        {onAttachFile && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="flex-shrink-0 p-2 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 disabled:opacity-50 transition-colors"
              title="Attach document"
            >
              {uploading ? (
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              )}
            </button>
          </>
        )}
        <textarea
          value={text}
          onChange={handleTextChange}
          onKeyDown={(e) =>{
            if(e.key === "Enter" && !e.shiftKey){
              e.preventDefault();
              handleSubmit(e as any);
            }
          }}
          placeholder={attachedFilename ? "Ask about your document..." : "Ask anything..."}
          disabled={disabled}
          rows = {1}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-none overflow-hidden"
          style = {{minHeight:"38px", maxHeight:"160px"}}
        />
        <button
          type="submit"
          disabled={disabled || !text.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </form>
    </div>
  );
}
