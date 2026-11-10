/**
 * One count against its limit: "41 of 64 matches". The figures are printed,
 * so the bar only has to show how far along it is. The unfilled track is a
 * lighter step of the same blue, so the whole bar reads as one measure.
 */
export function Meter({
  label,
  value,
  of,
  unit,
}: {
  label: string;
  value: number;
  of: number;
  unit: string;
}) {
  const pct = of ? Math.round((value / of) * 100) : 0;
  return (
    <div className="viz-root">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="text-xs text-slate-500 whitespace-nowrap">
          <span className="font-semibold text-slate-900">{pct}%</span> · {value.toLocaleString("en-GB")} of{" "}
          {of.toLocaleString("en-GB")} {unit}
        </span>
      </div>
      <div
        className="mt-1.5 h-2 rounded-full overflow-hidden"
        style={{ background: "var(--viz-track)" }}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={of}
        aria-valuenow={value}
        aria-valuetext={`${value} of ${of} ${unit}`}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--viz-series-1)" }} />
      </div>
    </div>
  );
}
