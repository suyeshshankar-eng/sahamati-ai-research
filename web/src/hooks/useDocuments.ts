import { useState, useEffect, useCallback } from "react";
import {
  listDocuments,
  uploadDocument,
  deleteDocument as apiDelete,
  updateDocumentMeta,
} from "../api/client";

export function useDocuments() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDocuments();
      setDocuments(res.documents);
      setCategories(res.categories);
      setAllTags(res.allTags);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upload = async (file: File, opts?: { category?: string; tags?: string[] }) => {
    const res = await uploadDocument(file, opts);
    await refresh();
    return res.document;
  };

  const remove = async (id: string) => {
    await apiDelete(id);
    await refresh();
  };

  const updateMeta = async (id: string, meta: { category?: string | null; tags?: string[] | null }) => {
    await updateDocumentMeta(id, meta);
    await refresh();
  };

  return { documents, categories, allTags, total, loading, upload, remove, updateMeta, refresh };
}
