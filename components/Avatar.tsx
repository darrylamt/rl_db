"use client";

import { useState } from "react";

/**
 * A photo or crest, falling back to initials.
 *
 * Player photos came from a source whose links expire, so a broken image is
 * not an edge case here — it is what a squad list looks like a few months
 * on. A browser's own broken-image icon says nothing about who is missing;
 * initials at least name them.
 *
 * The fallback also covers the case of no URL at all, so callers do not need
 * their own empty state.
 */
export function Avatar({
  src,
  name,
  size = 40,
  rounded = "full",
  className = "",
  contain = false,
}: {
  src?: string | null;
  /** Used for the initials, and read out to anyone who cannot see it. */
  name?: string | null;
  size?: number;
  rounded?: "full" | "md" | "none";
  className?: string;
  /** Crests should sit inside the box; photos should fill it. */
  contain?: boolean;
}) {
  const [broken, setBroken] = useState(false);

  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const radius =
    rounded === "full" ? "rounded-full" : rounded === "md" ? "rounded" : "";

  const box = `shrink-0 ${radius} ${className}`;
  const style = { width: size, height: size };

  if (!src || broken) {
    return (
      <span
        style={{ ...style, fontSize: Math.max(9, Math.round(size * 0.36)) }}
        className={`${box} bg-slate-200 text-slate-600 font-semibold grid place-items-center select-none leading-none`}
        aria-label={name ?? undefined}
        title={name ?? undefined}
      >
        {initials || "—"}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ?? ""}
      style={style}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`${box} ${contain ? "object-contain" : "object-cover"} bg-slate-100`}
    />
  );
}
