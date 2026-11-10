"use client";

import { useState } from "react";
import { Tooltip, TipRow, fmt, useWidth } from "./Tooltip";

/**
 * Ranked horizontal bars, largest first, one colour: bars on one baseline
 * compare more exactly than slices of a pie. Each value sits at its bar's
 * tip, so the tooltip only adds the share of the whole.
 */
export function RankedBars({
  items,
  unit,
  total,
  label,
}: {
  items: { label: string; value: number; note?: string }[];
  unit: string;
  /** The whole these are part of, for the share in the tooltip. */
  total?: number;
  label: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [tipY, setTipY] = useState(0);
  const max = Math.max(1, ...items.map((i) => i.value));

  const show = (i: number, el: HTMLElement) => {
    const box = ref.current?.getBoundingClientRect();
    const row = el.getBoundingClientRect();
    setTipY(box ? row.top - box.top + 4 : 0);
    setActive(i);
  };

  return (
    <div ref={ref} className="relative" role="list" aria-label={label}>
      {items.map((it, i) => {
        const share = it.value / max;
        return (
          <div
            key={`${it.label}-${i}`}
            role="listitem"
            tabIndex={0}
            aria-label={`${it.label}: ${fmt(it.value)} ${unit}`}
            onPointerEnter={(e) => show(i, e.currentTarget)}
            onPointerLeave={() => setActive(null)}
            onFocus={(e) => show(i, e.currentTarget)}
            onBlur={() => setActive(null)}
            className={`grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] items-center gap-3 px-2 py-1 rounded outline-none ${
              active === i ? "bg-slate-50" : ""
            }`}
          >
            <span className="text-sm text-slate-700 truncate">
              {it.label}
              {it.note && <span className="text-slate-400"> · {it.note}</span>}
            </span>
            <span className="flex items-center gap-2 min-w-0">
              <span
                aria-hidden
                className="h-3.5 shrink-0"
                style={{
                  width: `calc((100% - 3rem) * ${share})`,
                  minWidth: it.value > 0 ? 2 : 0,
                  background: "var(--viz-series-1)",
                  borderRadius: "0 4px 4px 0",
                }}
              />
              <span className="text-xs font-medium text-slate-900 tabular-nums">{fmt(it.value)}</span>
            </span>
          </div>
        );
      })}

      {active != null && width > 0 && (
        <Tooltip x={width * 0.55} y={tipY} containerWidth={width}>
          <p className="text-[11px] text-slate-500 mb-1 truncate">{items[active].label}</p>
          <TipRow value={fmt(items[active].value)} label={unit} />
          {total ? (
            <TipRow value={`${Math.round((items[active].value / total) * 100)}%`} label="of the whole" />
          ) : null}
        </Tooltip>
      )}
    </div>
  );
}
