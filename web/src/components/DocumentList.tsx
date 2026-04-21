import { useState } from "react";
import { useNavigate } from "react-router";

interface Document {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  isImage: boolean;
  category: string | null;
  tags: string[];
  createdAt: string;
}

interface Props {
  documents: Document[];
  onSelect: (doc: Document) => void;
  onDelete: (id: string) => void;
  onUpdateMeta: (id: string, meta: { category?: string | null; tags?: string[] | null }) => void;
  existingCategories: string[];
  existingTags: string[];
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word") || mimeType.includes("document")) return "DOC";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType === "text/csv")
    return "XLS";
  if (mimeType.startsWith("image/")) return "IMG";
  return "TXT";
}

function TagEditor({
  doc,
  existingCategories,
  existingTags,
  onSave,
  onClose,
}: {
  doc: Document;
  existingCategories: string[];
  existingTags: string[];
  onSave: (meta: { category?: string | null; tags?: string[] | null }) => void;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(doc.category ?? "");
  const [tagInput, setTagInput] = useState(doc.tags.join(", "));

  const handleSave = () => {
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      category: category.trim() || null,
      tags: tags.length > 0 ? tags : null,
    });
    onClose();
  };

  return (
    <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1">Category</label>
        <div className="flex gap-1 flex-wrap mb-1">
          {existingCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`text-xs px-2 py-0.5 rounded-full border ${
                category === c ? "bg-blue-100 border-blue-300 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-100"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Type or select category..."
          className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 block mb-1">Tags</label>
        <div className="flex gap-1 flex-wrap mb-1">
          {existingTags.map((t) => {
            const current = tagInput.split(",").map((s) => s.trim());
            const isActive = current.includes(t);
            return (
              <button
                key={t}
                onClick={() => {
                  if (isActive) {
                    setTagInput(current.filter((s) => s !== t).join(", "));
                  } else {
                    setTagInput([...current.filter(Boolean), t].join(", "));
                  }
                }}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  isActive ? "bg-green-100 border-green-300 text-green-700" : "border-gray-200 text-gray-500 hover:bg-gray-100"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="Comma-separated tags..."
          className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
          Cancel
        </button>
        <button onClick={handleSave} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
          Save
        </button>
      </div>
    </div>
  );
}

export function DocumentList({ documents, onSelect, onDelete, onUpdateMeta, existingCategories, existingTags }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (documents.length === 0) {
    return (
      <p className="text-gray-400 text-center py-8">
        No documents match your filters.
      </p>
    );
  }

  const navigate = useNavigate();

  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="bg-white rounded-lg border border-gray-200 px-4 py-3 hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => onSelect(doc)}
              className="flex items-center gap-3 flex-1 text-left"
            >
              <span className="bg-gray-100 text-gray-600 text-xs font-mono px-2 py-1 rounded flex-shrink-0">
                {fileIcon(doc.mimeType)}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                <p className="text-xs text-gray-400">
                  {formatSize(doc.sizeBytes)} &middot;{" "}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {doc.category && (
                <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                  {doc.category}
                </span>
              )}
              {doc.tags.map((tag) => (
                <span key={tag} className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(editingId === doc.id ? null : doc.id);
                }}
                className="text-gray-400 hover:text-blue-500 text-xs px-1"
                title="Edit category/tags"
              >
                Tag
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(doc.id);
                }}
                className="text-gray-400 hover:text-red-500 text-xs px-1"
                title="Delete"
              >
                Delete
              </button>
              {/* research page */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/research/${doc.id}`);
                }}
                className="text-gray-400 hover:text-blue-500 text-xs flex-shrink-0"
                title="Research"
                >
                Research
              </button>
            </div>
          </div>
          {editingId === doc.id && (
            <TagEditor
              doc={doc}
              existingCategories={existingCategories}
              existingTags={existingTags}
              onSave={(meta) => onUpdateMeta(doc.id, meta)}
              onClose={() => setEditingId(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
