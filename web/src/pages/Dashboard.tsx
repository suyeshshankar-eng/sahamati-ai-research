import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Layout } from "../components/Layout";
import { DocumentUpload } from "../components/DocumentUpload";
import { DocumentList } from "../components/DocumentList";
import { useDocuments } from "../hooks/useDocuments";

export function Dashboard() {
  const { documents, categories, allTags, total, loading, upload, remove, updateMeta } =
    useDocuments();
  const navigate = useNavigate();

  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result = documents;
    if (filterCategory) {
      result = result.filter((d) => d.category === filterCategory);
    }
    if (filterTag) {
      result = result.filter((d) => d.tags?.includes(filterTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.filename.toLowerCase().includes(q));
    }
    return result;
  }, [documents, filterCategory, filterTag, searchQuery]);

  const handleUpload = async (file: File) => {
    const doc = await upload(file);
    navigate(`/chat?doc=${doc.id}`);
  };

  // Stats by file type
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { PDF: 0, DOC: 0, XLS: 0, IMG: 0, TXT: 0 };
    for (const d of documents) {
      if (d.mimeType === "application/pdf") counts.PDF++;
      else if (d.mimeType.includes("word") || d.mimeType.includes("document")) counts.DOC++;
      else if (d.mimeType.includes("sheet") || d.mimeType.includes("excel") || d.mimeType === "text/csv") counts.XLS++;
      else if (d.mimeType.startsWith("image/")) counts.IMG++;
      else counts.TXT++;
    }
    return counts;
  }, [documents]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header with count */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
            <p className="text-sm text-gray-400">
              {total} document{total !== 1 ? "s" : ""}
              {filterCategory || filterTag ? ` (${filtered.length} shown)` : ""}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && total > 0 && (
          <div className="flex gap-3 mb-4">
            {Object.entries(typeCounts)
              .filter(([, count]) => count > 0)
              .map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5"
                >
                  <span className="text-xs font-mono text-gray-500">{type}</span>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
          </div>
        )}

        {/* Upload */}
        <DocumentUpload onUpload={handleUpload} />

        {/* Filters */}
        {!loading && (categories.length > 0 || allTags.length > 0) && (
          <div className="mt-4 space-y-2">
            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />

            {/* Category filters */}
            {categories.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">Category:</span>
                <button
                  onClick={() => setFilterCategory(null)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    !filterCategory
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "border-gray-200 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      filterCategory === cat
                        ? "bg-blue-100 border-blue-300 text-blue-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Tag filters */}
            {allTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">Tags:</span>
                <button
                  onClick={() => setFilterTag(null)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    !filterTag
                      ? "bg-green-100 border-green-300 text-green-700"
                      : "border-gray-200 text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  All
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                    className={`text-xs px-2 py-0.5 rounded-full border ${
                      filterTag === tag
                        ? "bg-green-100 border-green-300 text-green-700"
                        : "border-gray-200 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Document list */}
        <div className="mt-4">
          {loading ? (
            <p className="text-gray-400 text-center py-8">Loading...</p>
          ) : (
            <DocumentList
              documents={filtered}
              onSelect={(doc) => navigate(`/chat?doc=${doc.id}`)}
              onDelete={remove}
              onUpdateMeta={updateMeta}
              existingCategories={categories}
              existingTags={allTags}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
