"use client";

import { useState } from "react";

export type Tab = { key: string; label: string; count?: number; content: React.ReactNode };

/**
 * Timeline, line-ups and stats, one at a time.
 *
 * Everything used to be stacked on one page, which on a phone meant
 * scrolling past thirty names to reach the stats. The panels themselves are
 * rendered on the server and handed in as children — this only decides which
 * one is on screen, so switching costs nothing and no data is fetched twice.
 *
 * Every panel stays mounted-but-hidden rather than being unmounted, so
 * scrolling back to a tab returns it where it was.
 */
export function MatchTabs({ tabs }: { tabs: Tab[] }) {
  const shown = tabs.filter((t) => t.content);
  const [active, setActive] = useState(shown[0]?.key ?? "");

  if (shown.length === 0) return null;
  if (shown.length === 1) return <>{shown[0].content}</>;

  return (
    <div className="mb-6">
      <div
        role="tablist"
        className="flex gap-1 border-b border-white/10 mb-4 overflow-x-auto"
      >
        {shown.map((t) => {
          const on = t.key === active;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition ${
                on
                  ? "border-ghanaYellow-500 text-white font-medium"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className="ml-1.5 text-xs text-slate-500">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {shown.map((t) => (
        <div key={t.key} role="tabpanel" hidden={t.key !== active}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
