"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Tooltip, TipRow, fmt, useWidth } from "./Tooltip";

export type Part = {
  key: string;
  label: string;
  value: number;
  color: string;
  /** Text inside the block: white, or near-black on the light yellow. */
  ink?: "light" | "dark";
};

/**
 * One whole split into a few parts, read at a glance: the honest version of
 * a pie. Each part is its own block, its share printed inside where it fits;
 * the legend under it names the parts in the same order. A share too wide
 * for its block is left off rather than cut, and stays in the tooltip and
 * the table.
 */
export function SegmentedBar({ parts, unit, label }: { parts: Part[]; unit: string; label: string }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [fits, setFits] = useState<boolean[]>([]);
  const blocks = useRef<(HTMLDivElement | null)[]>([]);
  const labels = useRef<(HTMLSpanElement | null)[]>([]);

  const shown = parts.filter((p) => p.value > 0); // a part at zero draws nothing
  const total = shown.reduce((s, p) => s + p.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  // Measure, then decide: a label goes in only with room either side.
  useLayoutEffect(() => {
    setFits(
      shown.map((_, i) => {
        const b = blocks.current[i];
        const l = labels.current[i];
        return !!b && !!l && l.scrollWidth + 16 <= b.clientWidth;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, total, shown.length]);

  const center = (i: number) => {
    const b = blocks.current[i];
    const box = ref.current?.getBoundingClientRect();
    if (!b || !box) return 0;
    const r = b.getBoundingClientRect();
    return r.left - box.left + r.width / 2;
  };

  return (
    <div>
      <div
        ref={ref}
        className="relative flex gap-[2px] h-7"
        role="img"
        aria-label={`${label}: ${shown.map((p) => `${p.label} ${fmt(p.value)} (${pct(p.value)}%)`).join(", ")}`}
      >
        {shown.map((p, i) => (
          <div
            key={p.key}
            ref={(el) => {
              blocks.current[i] = el;
            }}
            tabIndex={0}
            aria-label={`${p.label}: ${fmt(p.value)} ${unit}, ${pct(p.value)}%`}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="h-full rounded flex items-center outline-none transition-[filter]"
            style={{
              flexGrow: p.value,
              flexBasis: 0,
              minWidth: 2,
              background: p.color,
              filter: active === i ? "brightness(1.08)" : undefined,
            }}
          >
            <span
              ref={(el) => {
                labels.current[i] = el;
              }}
              className="pl-2 text-xs font-semibold whitespace-nowrap tabular-nums"
              style={{
                color: p.ink === "dark" ? "#0b0b0b" : "#ffffff",
                visibility: fits[i] ? "visible" : "hidden",
              }}
            >
              {pct(p.value)}%
            </span>
          </div>
        ))}

        {active != null && width > 0 && shown[active] && (
          <Tooltip x={center(active)} y={0} containerWidth={width}>
            <p className="text-[11px] text-slate-500 mb-1">{shown[active].label}</p>
            <TipRow value={fmt(shown[active].value)} label={unit} />
            <TipRow value={`${pct(shown[active].value)}%`} label="of the whole" />
          </Tooltip>
        )}
      </div>

      {/* Names only, in block order; the numbers are on the bar and in the table. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-600">
        {shown.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden className="w-2.5 h-2.5 rounded-[2px]" style={{ background: p.color }} />
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
