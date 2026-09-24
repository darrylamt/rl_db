"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addMatchDocument,
  removeMatchDocument,
  type MatchDocument,
} from "@/lib/matchDocuments";

const KIND_LABEL: Record<MatchDocument["kind"], string> = {
  team_sheet: "Team sheet",
  events: "Scoring record",
  other: "Match sheet",
};

/**
 * Photos and scans of a match's team sheets and scoring record, kept against
 * the result so it can be checked later.
 *
 * Several can go on one match: each side's team sheet, the events sheet. A
 * photo goes straight from the phone to storage; a sheet already kept
 * elsewhere (the older ones are in Google Drive) can be linked instead.
 */
export function MatchSheets({
  fixtureId,
  documents,
  ready,
  canRemove,
  tone = "light",
}: {
  fixtureId: string;
  documents: MatchDocument[];
  ready: boolean;
  /** The federation may take a sheet off; recorders may only add. */
  canRemove: boolean;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const [kind, setKind] = useState<MatchDocument["kind"]>("team_sheet");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const dark = tone === "dark";
  const c = {
    box: dark ? "bg-neutral-950 border-white/10" : "bg-white border-slate-200",
    muted: dark ? "text-white/50" : "text-slate-500",
    input: dark
      ? "bg-neutral-900 border-white/15 text-white"
      : "bg-white border-slate-300 text-navy-900",
    item: dark ? "border-white/10 hover:bg-white/5" : "border-slate-200 hover:bg-slate-50",
    button: dark ? "bg-white text-black" : "bg-navy-900 text-white",
  };

  async function save(url: string) {
    const res = await addMatchDocument(fixtureId, { kind, url });
    if (res.error) throw new Error(res.error);
    startTransition(() => router.refresh());
  }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setError(null);
    try {
      for (const file of files) {
        setBusy(`Uploading ${file.name}…`);
        const res = await fetch("/api/match-sheets/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fixtureId, filename: file.name }),
        });
        const payload = await res.json();
        if (!payload?.ok) throw new Error(payload?.error ?? "Could not start the upload");
        const { bucket, path, token, publicUrl } = payload.data;
        const { error: upErr } = await createClient()
          .storage.from(bucket)
          .uploadToSignedUrl(path, token, file);
        if (upErr) throw new Error(upErr.message);
        await save(publicUrl);
      }
    } catch (err: any) {
      setError(err?.message ?? "Upload failed. Try again, or paste a link.");
    } finally {
      setBusy(null);
    }
  }

  async function onLink() {
    if (!link.trim()) return;
    setError(null);
    setBusy("Saving link…");
    try {
      await save(link.trim());
      setLink("");
    } catch (err: any) {
      setError(err?.message ?? "Could not save the link.");
    } finally {
      setBusy(null);
    }
  }

  async function onRemove(d: MatchDocument) {
    if (!confirm(`Take this ${KIND_LABEL[d.kind].toLowerCase()} off the match? The file itself is kept.`)) return;
    setError(null);
    const res = await removeMatchDocument(fixtureId, d.document_id);
    if (res.error) setError(res.error);
    else startTransition(() => router.refresh());
  }

  const isImage = (url: string) => /\.(jpe?g|png|webp|gif|heic|heif)(\?|$)/i.test(url);

  return (
    <section className={`mb-6 border rounded-lg p-4 ${c.box}`}>
      <h2 className="font-display text-base mb-1">Match sheets</h2>
      <p className={`text-xs mb-4 ${c.muted}`}>
        Photos or scans of the team sheets and the scoring record, kept with the result so it
        can be checked later. Shown on the public match page.
      </p>

      {!ready && (
        <p className="text-xs text-amber-600 mb-4">
          Not set up yet: run <code>supabase/match_sheets.sql</code> in Supabase first.
        </p>
      )}

      {documents.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {documents.map((d) => (
            <li key={d.document_id} className={`border rounded-md overflow-hidden ${c.item}`}>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="block">
                {isImage(d.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.url} alt={KIND_LABEL[d.kind]} referrerPolicy="no-referrer"
                    className="w-full aspect-[4/3] object-cover" loading="lazy" />
                ) : (
                  <div className={`w-full aspect-[4/3] grid place-items-center text-xs ${c.muted}`}>
                    {/drive\.google/i.test(d.url) ? "Google Drive" : /\.pdf(\?|$)/i.test(d.url) ? "PDF" : "Open"} ↗
                  </div>
                )}
              </a>
              <div className="p-2 text-xs flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block font-medium">{KIND_LABEL[d.kind]}</span>
                  <span className={`block truncate ${c.muted}`}>
                    {d.uploaded_by === "import" ? "From the old website" : d.uploaded_by ?? ""}
                  </span>
                </span>
                {canRemove && (
                  <button type="button" onClick={() => onRemove(d)}
                    className="text-red-600 hover:underline shrink-0">
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
        <label className={`text-xs ${c.muted}`} htmlFor="sheet-kind">This is a</label>
        <select id="sheet-kind" value={kind} onChange={(e) => setKind(e.target.value as any)}
          className={`px-3 py-2 rounded border text-sm ${c.input}`}>
          <option value="team_sheet">Team sheet</option>
          <option value="events">Scoring record</option>
          <option value="other">Other match sheet</option>
        </select>

        <span className={`text-xs ${c.muted}`}>Upload</span>
        {/* capture is left off so a phone offers both the camera and its photos. */}
        <input type="file" multiple accept="image/*,application/pdf" onChange={onFiles}
          disabled={!!busy || !ready}
          className={`block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium ${dark ? "file:bg-white file:text-black" : "file:bg-navy-900 file:text-white"} disabled:opacity-60`} />

        <span className={`text-xs ${c.muted}`}>or link</span>
        <div className="flex gap-2">
          <input type="url" value={link} onChange={(e) => setLink(e.target.value)}
            placeholder="https://drive.google.com/…" disabled={!ready}
            className={`flex-1 min-w-0 px-3 py-2 rounded border text-sm ${c.input}`} />
          <button type="button" onClick={onLink} disabled={!!busy || !link.trim() || !ready}
            className={`px-3 py-2 rounded text-sm font-medium disabled:opacity-50 ${c.button}`}>
            Add
          </button>
        </div>
      </div>

      {busy && <p className={`text-xs mt-3 ${c.muted}`}>{busy}</p>}
      {error && <p className="text-xs mt-3 text-red-600">{error}</p>}
    </section>
  );
}
