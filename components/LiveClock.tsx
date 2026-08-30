"use client";

import { useEffect, useState } from "react";
import { clockLabel, clockState, type MatchClock } from "@/lib/matchClock";

/**
 * The match minute, for anyone watching.
 *
 * A client component only because it has to tick. The minute itself comes
 * from the fixture's timestamps, so it is right the moment the page loads —
 * someone opening this in the seventieth minute sees the seventieth minute,
 * without waiting for an update from the ground.
 */
export function LiveClock({
  fixture,
  className = "",
}: {
  fixture: MatchClock;
  className?: string;
}) {
  const state = clockState(fixture);
  const [, tick] = useState(0);

  // Only a running clock changes. Half time and full time say the same
  // thing every second, so they are left alone.
  useEffect(() => {
    if (state !== "running") return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [state]);

  if (state === "not_started") return null;

  const label = clockLabel(fixture);
  const live = state === "running";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-display tabular-nums ${className}`}
      // So a screen reader announces the change rather than re-reading the page.
      aria-live="polite"
    >
      {live && (
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
