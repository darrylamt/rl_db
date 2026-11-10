"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Width of the element, kept up to date as the layout changes. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

/**
 * The hover readout, placed above a point inside the chart and kept inside
 * its edges. Values lead and names follow: the reader already knows which
 * mark they pointed at and wants the number.
 */
export function Tooltip({
  x,
  y,
  containerWidth,
  children,
}: {
  x: number;
  y: number;
  containerWidth: number;
  children: ReactNode;
}) {
  const half = 90;
  const left = Math.max(half, Math.min(containerWidth - half, x));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 bg-white border border-slate-200 shadow-lg rounded-md px-3 py-2 text-xs min-w-[8rem] max-w-[15rem]"
      style={{ left, top: y, transform: "translate(-50%, calc(-100% - 8px))" }}
    >
      {children}
    </div>
  );
}

/** One row of a tooltip: a short line in the series colour, the value, the name. */
export function TipRow({
  color,
  value,
  label,
}: {
  color?: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {color && (
        <span
          aria-hidden
          className="inline-block w-3 h-0.5 rounded-full shrink-0"
          style={{ background: color }}
        />
      )}
      <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
      <span className="text-slate-500 truncate">{label}</span>
    </div>
  );
}

export const fmt = (n: number, decimals = 0) =>
  n.toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
