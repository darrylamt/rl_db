"use client";

import { useState } from "react";

/**
 * Share this page.
 *
 * On a phone, the phone's own share sheet (Snapchat, WhatsApp, Instagram,
 * Messages…). Where there is none, as on most desktops, the link is copied
 * and the button says so. Only the link is shared: the app on the other end
 * builds the preview card from the page's own tags (lib/liveShare).
 */
export function ShareButton({ title, className = "" }: { title?: string; className?: string }) {
  const [note, setNote] = useState<string | null>(null);

  async function share() {
    const url = window.location.href;
    const text = title ?? document.title;
    if (navigator.share) {
      try {
        await navigator.share({ url, title: text, text });
      } catch (e: any) {
        // Closing the sheet is not a failure.
        if (e?.name !== "AbortError") setNote("Couldn't share");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNote("Link copied");
    } catch {
      setNote("Couldn't copy");
    }
    setTimeout(() => setNote(null), 2500);
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 text-xs text-slate-200 hover:border-white/40 hover:text-ghanaYellow-500 transition ${className}`}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      {note ?? "Share"}
    </button>
  );
}
