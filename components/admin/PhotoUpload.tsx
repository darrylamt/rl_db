"use client";

import { useState } from "react";

export function PhotoUpload({
  name,
  currentUrl,
  label = "Photo",
  shape = "round",
}: {
  name: string;
  currentUrl?: string | null;
  label?: string;
  shape?: "round" | "square";
}) {
  const [preview, setPreview] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) { setPreview(null); return; }
    setPreview(URL.createObjectURL(file));
  }

  const shown = preview ?? currentUrl;
  const imgCls =
    shape === "round"
      ? "h-20 w-20 rounded-full object-cover border border-slate-200"
      : "h-20 w-20 rounded-lg object-cover border border-slate-200";

  return (
    <div className="space-y-2">
      {shown && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="" className={imgCls} />
      )}
      <input
        type="file"
        name={name}
        accept="image/*"
        onChange={handleChange}
        className="block text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-navy-900 file:text-white hover:file:bg-navy-800 cursor-pointer"
      />
      {currentUrl && !preview && (
        <p className="text-xs text-slate-400">Leave empty to keep existing {label.toLowerCase()}.</p>
      )}
    </div>
  );
}
