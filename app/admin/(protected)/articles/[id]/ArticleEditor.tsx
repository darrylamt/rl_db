"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { saveArticle, setArticleStatus, deleteArticle } from "../actions";

interface Article {
  article_id: string;
  title: string;
  slug: string | null;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  author: string | null;
  tags: string[];
  status: string;
  published_at: string | null;
}

export function ArticleEditor({ article }: { article: Article }) {
  const [title, setTitle]           = useState(article.title);
  const [content, setContent]       = useState(article.content);
  const [excerpt, setExcerpt]       = useState(article.excerpt ?? "");
  const [coverUrl, setCoverUrl]     = useState(article.cover_image_url ?? "");
  const [author, setAuthor]         = useState(article.author ?? "");
  const [tagsRaw, setTagsRaw]       = useState((article.tags ?? []).join(", "));
  const [status, setStatus]         = useState(article.status);
  const [saveMsg, setSaveMsg]         = useState("");
  const [error, setError]             = useState("");
  const [isPending, startTransition]  = useTransition();
  const [coverUploading, setCoverUploading] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Auto-save every 30s if content has changed
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setDirty(true); }, [title, content, excerpt, coverUrl, author, tagsRaw]);

  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => handleSave(false), 30_000);
    return () => clearTimeout(t);
  });

  function handleSave(showMsg = true) {
    setError("");
    const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);
    startTransition(async () => {
      try {
        await saveArticle(article.article_id, {
          title,
          content,
          excerpt: excerpt.trim() || null,
          cover_image_url: coverUrl.trim() || null,
          author: author.trim() || null,
          tags,
        });
        setDirty(false);
        if (showMsg) {
          setSaveMsg("Saved ✓");
          setTimeout(() => setSaveMsg(""), 2500);
        }
      } catch (e: any) {
        setError(e.message ?? "Failed to save");
      }
    });
  }

  function handleStatusChange(newStatus: "draft" | "published" | "archived") {
    setError("");
    startTransition(async () => {
      try {
        // Save content first, then flip status
        const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);
        await saveArticle(article.article_id, {
          title, content,
          excerpt: excerpt.trim() || null,
          cover_image_url: coverUrl.trim() || null,
          author: author.trim() || null,
          tags,
        });
        await setArticleStatus(article.article_id, newStatus);
        setStatus(newStatus);
        setSaveMsg(newStatus === "published" ? "Published ✓" : newStatus === "draft" ? "Moved to drafts ✓" : "Archived ✓");
        setTimeout(() => setSaveMsg(""), 3000);
      } catch (e: any) {
        setError(e.message ?? "Failed");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Delete this article permanently? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteArticle(article.article_id);
    });
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/articles/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setCoverUrl(json.url);
    } catch (err: any) {
      setError(err.message ?? "Image upload failed");
    } finally {
      setCoverUploading(false);
      e.target.value = "";
    }
  }

  const statusColors: Record<string, string> = {
    draft: "bg-slate-100 text-slate-600",
    published: "bg-emerald-100 text-emerald-700",
    archived: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <Link href="/admin/articles" className="text-xs text-slate-500 hover:underline mb-1 inline-block">
            ← Articles
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-navy-900 truncate">
              {title || <span className="text-slate-400 font-normal">Untitled article</span>}
            </h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${statusColors[status] ?? statusColors.draft}`}>
              {status}
            </span>
          </div>
          {article.slug && (
            <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">/{article.slug}</p>
          )}
        </div>

        {/* Toolbar actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {saveMsg && <span className="text-xs text-emerald-700 font-medium">{saveMsg}</span>}
          {error  && <span className="text-xs text-red-600">{error}</span>}

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isPending}
            className="px-3 py-1.5 rounded border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Saving…" : "Save"}
          </button>

          {status !== "published" && (
            <button
              type="button"
              onClick={() => handleStatusChange("published")}
              disabled={isPending || !title.trim()}
              className="px-4 py-1.5 rounded bg-emerald-700 text-white text-sm font-medium hover:bg-emerald-800 disabled:opacity-50 transition-colors"
              title={!title.trim() ? "Add a title before publishing" : ""}
            >
              Publish
            </button>
          )}
          {status === "published" && (
            <button
              type="button"
              onClick={() => handleStatusChange("draft")}
              disabled={isPending}
              className="px-3 py-1.5 rounded border border-amber-300 text-amber-700 text-sm hover:bg-amber-50 disabled:opacity-50 transition-colors"
            >
              Unpublish
            </button>
          )}

          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="px-2 py-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 text-sm transition-colors"
            title="Delete article"
          >
            Delete
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded mb-4">{error}</div>
      )}

      <div className="space-y-4">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Article title…"
          className="w-full text-2xl font-display font-bold text-navy-900 px-0 py-1 bg-transparent border-0 border-b-2 border-slate-200 focus:border-navy-500 focus:outline-none placeholder:text-slate-300"
        />

        {/* Rich text editor */}
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Write your article here…"
        />

        {/* Metadata panel */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-semibold text-slate-700">Article details</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name"
                className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Tags</label>
              <input
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="match report, premier league, …"
                className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
              />
              <p className="text-xs text-slate-400 mt-0.5">Comma-separated</p>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Excerpt / Summary</label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Short summary shown in article listings…"
              rows={2}
              className="w-full px-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-navy-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Cover image</label>

            {/* Hidden file input */}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              onChange={handleCoverUpload}
            />

            {/* Upload / change / remove row */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading || isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {coverUploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Uploading…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                      <path d="M7.25 10.25a.75.75 0 0 0 1.5 0V4.56l1.22 1.22a.75.75 0 1 0 1.06-1.06l-2.5-2.5a.75.75 0 0 0-1.06 0l-2.5 2.5a.75.75 0 0 0 1.06 1.06l1.22-1.22v5.69Z" />
                      <path d="M3.5 9.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 14h6.5A2.75 2.75 0 0 0 14 11.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25h-6.5c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
                    </svg>
                    {coverUrl ? "Change image" : "Upload image"}
                  </>
                )}
              </button>

              {coverUrl && !coverUploading && (
                <button
                  type="button"
                  onClick={() => setCoverUrl("")}
                  className="text-xs text-red-500 hover:text-red-700 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-1">JPEG, PNG, WebP, GIF or AVIF · max 8 MB</p>

            {/* Preview */}
            {coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt="cover preview"
                referrerPolicy="no-referrer"
                className="mt-2 h-40 w-full object-cover rounded-lg border border-slate-200"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
