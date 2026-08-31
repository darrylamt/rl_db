"use client";

import { useState } from "react";

/**
 * Takes the addresses currently on screen.
 *
 * Two shapes because there are two jobs. Addresses alone go in the To: field
 * of a message to everybody. Name and address, tab separated, paste into a
 * spreadsheet as two columns — which is what somebody handing out logins one
 * by one actually needs, since every account starts on the same password and
 * the address is the only thing that differs.
 */
export function CopyEmails({
  rows,
}: {
  rows: { name: string; email: string }[];
}) {
  const [done, setDone] = useState<null | "emails" | "pairs">(null);

  const copy = async (what: "emails" | "pairs") => {
    const text =
      what === "emails"
        ? rows.map((r) => r.email).join(", ")
        : rows.map((r) => `${r.name}\t${r.email}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setDone(what);
      setTimeout(() => setDone(null), 2000);
    } catch {
      // Clipboard refused — nothing useful to say, and the list is on screen.
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="flex gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => copy("emails")}
        className="text-xs px-3 py-2 rounded border border-navy-300 text-navy-800 hover:bg-navy-50"
      >
        {done === "emails" ? `Copied ${rows.length}` : `Copy ${rows.length} addresses`}
      </button>
      <button
        type="button"
        onClick={() => copy("pairs")}
        className="text-xs px-3 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
        title="Name and address, tab separated — pastes into a spreadsheet as two columns"
      >
        {done === "pairs" ? "Copied" : "Copy with names"}
      </button>
    </div>
  );
}
