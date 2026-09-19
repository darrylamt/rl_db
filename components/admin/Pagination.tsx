"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Two skins, because this is used on both sides of the site.
 *
 * It was written for the light admin and then reused on /live, which is a
 * near-black page: "Showing 1-25 of 189" was slate-600 on almost-black and
 * could not be read at all. Same fix as the searchable select — a tone rather
 * than a second component.
 */
const SKIN = {
  light: {
    wrap: "text-slate-600",
    active: "border-slate-300 bg-white text-navy-900 hover:bg-slate-50",
    disabled: "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed",
    page: "text-slate-500",
  },
  dark: {
    wrap: "text-slate-400",
    active:
      "border-white/15 bg-neutral-900 text-white hover:border-white/40",
    disabled:
      "border-white/5 bg-neutral-950 text-slate-600 cursor-not-allowed",
    page: "text-slate-500",
  },
} as const;

export function Pagination({
  page,
  pageSize,
  total,
  tone = "light",
}: {
  page: number;
  pageSize: number;
  total: number;
  tone?: keyof typeof SKIN;
}) {
  const skin = SKIN[tone];
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  function hrefFor(p: number) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (p <= 1) sp.delete("page");
    else sp.set("page", String(p));
    const qs = sp.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btnBase =
    "px-3 py-1.5 rounded border text-sm font-medium transition";
  const btnActive = skin.active;
  const btnDisabled = skin.disabled;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 text-sm mt-4 ${skin.wrap}`}
    >
      <div>
        {total === 0
          ? "No results"
          : `Showing ${from}–${to} of ${total}`}
      </div>
      <div className="flex items-center gap-1.5">
        {prev ? (
          <Link href={hrefFor(prev)} className={`${btnBase} ${btnActive}`}>
            ← Prev
          </Link>
        ) : (
          <span className={`${btnBase} ${btnDisabled}`}>← Prev</span>
        )}
        <span className={`px-2 text-xs whitespace-nowrap ${skin.page}`}>
          Page {page} / {totalPages}
        </span>
        {next ? (
          <Link href={hrefFor(next)} className={`${btnBase} ${btnActive}`}>
            Next →
          </Link>
        ) : (
          <span className={`${btnBase} ${btnDisabled}`}>Next →</span>
        )}
      </div>
    </div>
  );
}
