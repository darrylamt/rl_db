"use client";

import { useState } from "react";
import { Tooltip, TipRow, fmt, useWidth } from "./Tooltip";

export type ColumnSeries = { key: string; label: string; color: string };

const PAD_TOP = 20; // room for the value on each column's cap
const PLOT_H = 180;
const AXIS_H = 24; // the x-axis labels, inside the chart's own height
const LEFT = 34; // y-axis ticks
const GAP = 2; // surface gap between stacked segments
const MAX_COL = 24;

/** Clean tick steps: 1, 2 or 5 of a power of ten, about four of them. */
function niceScale(max: number, ticks = 4) {
  if (max <= 0) return { top: 1, step: 1 };
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const whole = Math.max(1, step);
  return { top: Math.ceil(max / whole) * whole, step: whole };
}

/** A column with a 4px rounded end at the top and a square foot on the baseline. */
function roundedTop(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Columns over a sequence (seasons), one series or several stacked.
 *
 * Each column's total sits on its cap; the split between series is in the
 * legend, the tooltip and the table, so the plot carries one number per
 * column rather than one per segment.
 */
export function ColumnChart({
  categories,
  series,
  values,
  unit,
  decimals = 0,
  label,
}: {
  categories: string[];
  series: ColumnSeries[];
  /** One entry per category: the value of each series, by its key. */
  values: Record<string, number>[];
  unit: string;
  decimals?: number;
  /** What the chart shows, for screen readers. */
  label: string;
}) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const totals = values.map((v) => series.reduce((s, x) => s + (v[x.key] ?? 0), 0));
  const { top, step } = niceScale(Math.max(0, ...totals));
  const ticks: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += step) ticks.push(t);

  const plotW = Math.max(0, width - LEFT - 4);
  const band = categories.length ? plotW / categories.length : 0;
  const colW = Math.min(MAX_COL, band * 0.6);
  const base = PAD_TOP + PLOT_H;
  const y = (v: number) => (v / top) * PLOT_H;
  const everyOther = band < 30;

  const stacks = values.map((v, i) => {
    const x = LEFT + band * i + (band - colW) / 2;
    const visible = series.filter((s) => (v[s.key] ?? 0) > 0);
    let cum = 0;
    const segs = visible.map((s, k) => {
      const h = y(v[s.key] ?? 0);
      const yTop = base - cum - h;
      cum += h;
      // Every segment above the first gives up its bottom 2px to the gap.
      const trim = k > 0 ? GAP : 0;
      return { s, x, yTop, h: Math.max(0, h - trim), last: k === visible.length - 1 };
    });
    return { x, segs, capY: base - cum };
  });

  return (
    <div>
      {series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-xs text-slate-600">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden className="w-2.5 h-2.5 rounded-[2px]" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <div ref={ref} className="relative w-full" style={{ height: PAD_TOP + PLOT_H + AXIS_H }}>
        {width > 0 && (
          <svg width={width} height={PAD_TOP + PLOT_H + AXIS_H} role="img" aria-label={label}>
            {/* Hairline grid, solid and recessive. */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={LEFT}
                  x2={width - 4}
                  y1={base - y(t)}
                  y2={base - y(t)}
                  stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"}
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={LEFT - 6}
                  y={base - y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={10}
                  fill="var(--viz-muted)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmt(t)}
                </text>
              </g>
            ))}

            {/* The hovered column's band, behind it. */}
            {active != null && (
              <rect
                x={LEFT + band * active + 2}
                y={PAD_TOP - 4}
                width={Math.max(0, band - 4)}
                height={PLOT_H + 4}
                rx={4}
                fill="#f1f5f9"
              />
            )}

            {stacks.map((st, i) => (
              <g key={categories[i]}>
                {st.segs.map((g) =>
                  g.h <= 0 ? null : g.last ? (
                    <path key={g.s.key} d={roundedTop(g.x, g.yTop, colW, g.h)} fill={g.s.color} />
                  ) : (
                    <rect key={g.s.key} x={g.x} y={g.yTop} width={colW} height={g.h} fill={g.s.color} />
                  )
                )}
                {totals[i] > 0 && band >= 22 && (
                  <text
                    x={st.x + colW / 2}
                    y={st.capY - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--viz-ink-2)"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {fmt(totals[i], decimals)}
                  </text>
                )}
                {/* Every other label when they would crowd, always keeping the latest. */}
                {(!everyOther || (categories.length - 1 - i) % 2 === 0) && (
                  <text
                    x={st.x + colW / 2}
                    y={base + 16}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--viz-muted)"
                  >
                    {categories[i]}
                  </text>
                )}
              </g>
            ))}

            {/* The whole band is the hit target, not just the painted column. */}
            {categories.map((c, i) => (
              <rect
                key={c}
                x={LEFT + band * i}
                y={0}
                width={band}
                height={PAD_TOP + PLOT_H + AXIS_H}
                fill="transparent"
                tabIndex={0}
                aria-label={`${c}: ${fmt(totals[i], decimals)} ${unit}${
                  series.length > 1
                    ? ` (${series.map((s) => `${s.label} ${fmt(values[i][s.key] ?? 0, decimals)}`).join(", ")})`
                    : ""
                }`}
                onPointerEnter={() => setActive(i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                style={{ outline: "none", cursor: "default" }}
              />
            ))}
          </svg>
        )}

        {active != null && width > 0 && (
          // Above the column's total rather than over it.
          <Tooltip x={stacks[active].x + colW / 2} y={Math.min(stacks[active].capY - 18, base - 28)} containerWidth={width}>
            <p className="text-[11px] text-slate-500 mb-1">{categories[active]}</p>
            <TipRow value={fmt(totals[active], decimals)} label={series.length > 1 ? `${unit} in all` : unit} />
            {series.length > 1 &&
              series.map((s) => (
                <TipRow key={s.key} color={s.color} value={fmt(values[active][s.key] ?? 0, decimals)} label={s.label} />
              ))}
          </Tooltip>
        )}
      </div>
    </div>
  );
}
