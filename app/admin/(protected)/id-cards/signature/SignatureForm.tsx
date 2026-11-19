"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSignature } from "./actions";

/**
 * A phone photo can be several MB, more than a form may send, so the
 * picture is shrunk here first. The server then takes out the paper.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.9));
}

export function SignatureForm({ name, title }: { name: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const form = new FormData(e.currentTarget);
    const file = form.get("signature") as File | null;
    if (file && file.size > 0) form.set("signature", await shrink(file), "signature.jpg");
    const res = await saveSignature(form);
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Saved. Cards printed from now on carry this signature." } : { ok: false, text: res.error ?? "Could not save" });
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 max-w-xl">
      <label className="text-sm">
        <span className="block text-xs text-slate-500 mb-1">Signature picture</span>
        <input type="file" name="signature" accept="image/*" className="block w-full text-sm" />
        <span className="block text-xs text-slate-500 mt-1">
          Sign on plain white paper with a dark pen, then take a straight, well-lit photo. The paper is removed automatically.
        </span>
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          <span className="block text-xs text-slate-500 mb-1">Name printed under it</span>
          <input name="name" defaultValue={name} required className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500 mb-1">Title</span>
          <input name="title" defaultValue={title} className="w-full border border-slate-300 rounded px-3 py-2 text-sm" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={busy} className="bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white px-4 py-2 rounded text-sm font-medium">
          {busy ? "Saving…" : "Save"}
        </button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
