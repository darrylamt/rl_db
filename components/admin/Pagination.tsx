"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
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
  const btnActive =
    "border-slate-300 bg-white text-navy-900 hover:bg-slate-50";
  const btnDisabled =
    "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 mt-4">
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
        <span className="px-2 text-xs text-slate-500 whitespace-nowrap">
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
