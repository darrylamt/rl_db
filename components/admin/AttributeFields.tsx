"use client";

import { useState } from "react";
import { RadarChart } from "@/components/RadarChart";
import { ATTRIBUTE_AXES, PLAYER_ATTRIBUTES } from "@/lib/attributes";

/**
 * The five scouting attributes, with a live preview of the radar chart fans
 * will see. Inputs are plain form fields — the preview is cosmetic, the values
 * still submit with the surrounding form.
 */
export function AttributeFields({
  defaults,
}: {
  defaults: Record<string, number | null | undefined>;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      PLAYER_ATTRIBUTES.map((a) => [
        a.key,
        defaults[a.key] == null ? "" : String(defaults[a.key]),
      ])
    )
  );

  const parsed = PLAYER_ATTRIBUTES.map((a) => {
    const raw = values[a.key];
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  });

  const entered = parsed.filter((v): v is number => v !== null);
  const average = entered.length
    ? Math.round(entered.reduce((s, v) => s + v, 0) / entered.length)
    : null;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
      <div className="space-y-3">
        {PLAYER_ATTRIBUTES.map((a, i) => (
          <div key={a.key} className="flex items-center gap-3">
            <label
              htmlFor={a.key}
              className="w-20 shrink-0 text-xs uppercase tracking-wider text-slate-600"
            >
              {a.label}
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={parsed[i] ?? 0}
              onChange={(e) =>
                setValues((v) => ({ ...v, [a.key]: e.target.value }))
              }
              className="flex-1 accent-ghanaRed-600"
              aria-label={`${a.label} slider`}
            />
            <input
              id={a.key}
              name={a.key}
              type="number"
              min={0}
              max={100}
              placeholder="—"
              value={values[a.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [a.key]: e.target.value }))
              }
              className="w-20 px-2 py-1.5 rounded border border-slate-300 bg-white text-navy-900 text-sm tabular-nums focus:border-navy-700 focus:outline-none"
            />
          </div>
        ))}
        <p className="text-xs text-slate-500">
          0–100 each. Leave a field blank to mark it not rated — blank is not the
          same as 0, and a player with nothing entered shows no chart at all.
          {average !== null && (
            <span className="text-navy-700 font-medium">
              {" "}
              Overall {average}.
            </span>
          )}
        </p>
      </div>

      <div className="bg-neutral-950 rounded-lg p-2 text-white w-full md:w-64 shrink-0">
        {entered.length > 0 ? (
          <RadarChart
            axes={ATTRIBUTE_AXES}
            series={[
              { label: "Preview", values: parsed, color: "#c81e1e" },
            ]}
          />
        ) : (
          <p className="text-slate-500 text-xs text-center py-16 px-3">
            Enter attributes to preview the chart.
          </p>
        )}
      </div>
    </div>
  );
}
