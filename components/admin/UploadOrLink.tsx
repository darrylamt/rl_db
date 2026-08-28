"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputCls =
  "w-full px-3 py-2 rounded border border-slate-300 bg-white text-navy-900 focus:border-navy-700 focus:outline-none";

type Status =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "done"; name: string }
  | { kind: "error"; message: string };

/**
 * An upload box and a URL box for the same value.
 *
 * Both are offered because they're genuinely different jobs: uploading puts a
 * file in our storage, while the URL keeps pointing at something already
 * hosted elsewhere — the federation's existing documents are Google Drive
 * links, and those must keep working.
 *
 * The file goes straight from the browser to Supabase Storage using a signed
 * slot, never through a server action. Server actions cap the request body at
 * 1 MB (4.5 MB on Vercel), which no annual report would fit inside. Only the
 * resulting URL is submitted with the form.
 */
export function UploadOrLink({
  urlName,
  bucket,
  prefix,
  currentUrl,
  accept = "image/*",
  kind = "image",
  urlPlaceholder,
}: {
  urlName: string;
  bucket: "content-images" | "documents";
  prefix: string;
  currentUrl?: string | null;
  accept?: string;
  kind?: "image" | "document";
  urlPlaceholder?: string;
}) {
  const [url, setUrl] = useState(currentUrl ?? "");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus({ kind: "uploading", name: file.name });
    try {
      const res = await fetch("/api/admin/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, prefix, filename: file.name }),
      });
      const payload = await res.json();
      if (!payload?.ok) {
        throw new Error(payload?.error ?? "Could not start the upload");
      }

      const { path, token, publicUrl } = payload.data;
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(path, token, file);
      if (error) throw new Error(error.message);

      setUrl(publicUrl);
      setStatus({ kind: "done", name: file.name });
    } catch (err: any) {
      setStatus({
        kind: "error",
        message: err?.message ?? "Upload failed. Try again, or paste a link.",
      });
    }
  }

  const showImage = kind === "image" && url;

  return (
    <div className="space-y-2">
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-20 w-20 rounded-lg object-contain bg-slate-50 border border-slate-200"
        />
      )}

      <input
        type="file"
        accept={accept}
        onChange={handleChange}
        disabled={status.kind === "uploading"}
        className="block w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-navy-900 file:text-white hover:file:bg-navy-800 disabled:opacity-60 cursor-pointer"
      />

      {status.kind === "uploading" && (
        <p className="text-xs text-slate-500">Uploading {status.name}…</p>
      )}
      {status.kind === "done" && (
        <p className="text-xs text-emerald-700">
          Uploaded {status.name}. Save the form to keep it.
        </p>
      )}
      {status.kind === "error" && (
        <p className="text-xs text-red-700">{status.message}</p>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or link to it
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {/* The only value the form submits — an upload just fills it in. */}
      <input
        type="text"
        name={urlName}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setStatus({ kind: "idle" });
        }}
        placeholder={urlPlaceholder}
        className={inputCls}
      />
    </div>
  );
}
