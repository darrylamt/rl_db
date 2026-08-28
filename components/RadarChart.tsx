// Pure-SVG radar (pentagon) chart. No client JS, no charting library — it
// renders identically on the server, so it works inside server components.

export type RadarSeries = {
  label: string;
  /** One value per axis, in axis order. null renders as the centre point. */
  values: (number | null)[];
  /** Fill colour; the stroke is the same colour at full opacity. */
  color: string;
};

const VIEW = 400;
const CENTRE = VIEW / 2;
const RADIUS = 128;
const LABEL_GAP = 30;
/** Fractions of the radius at which grid rings are drawn. */
const RINGS = [0.2, 0.4, 0.6, 0.8, 1];

function pointAt(axisIndex: number, axisCount: number, ratio: number) {
  // First axis points straight up, the rest run clockwise.
  const angle = (-90 + (360 / axisCount) * axisIndex) * (Math.PI / 180);
  return {
    x: CENTRE + Math.cos(angle) * RADIUS * ratio,
    y: CENTRE + Math.sin(angle) * RADIUS * ratio,
    cos: Math.cos(angle),
    sin: Math.sin(angle),
  };
}

function polygon(axisCount: number, ratio: number) {
  return Array.from({ length: axisCount }, (_, i) => {
    const p = pointAt(i, axisCount, ratio);
    return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  }).join(" ");
}

export function RadarChart({
  axes,
  series,
  max = 100,
  className = "",
}: {
  axes: string[];
  series: RadarSeries[];
  max?: number;
  className?: string;
}) {
  const n = axes.length;

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      className={`w-full h-auto ${className}`}
      role="img"
      aria-label={`Attribute chart: ${axes.join(", ")}`}
    >
      {/* Grid rings — dashed, drawn under the data so the fill tints them */}
      {RINGS.map((r) => (
        <polygon
          key={r}
          points={polygon(n, r)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={r === 1 ? 0.85 : 0.35}
          strokeWidth={1}
          strokeDasharray="5 4"
        />
      ))}

      {/* Spokes */}
      {axes.map((_, i) => {
        const p = pointAt(i, n, 1);
        return (
          <line
            key={i}
            x1={CENTRE}
            y1={CENTRE}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            strokeOpacity={0.85}
            strokeWidth={1}
          />
        );
      })}

      {/* Data polygons */}
      {series.map((s) => {
        const points = s.values
          .slice(0, n)
          .map((v, i) => {
            const ratio = Math.max(0, Math.min(1, (v ?? 0) / max));
            const p = pointAt(i, n, ratio);
            return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
          })
          .join(" ");
        return (
          <polygon
            key={s.label}
            points={points}
            fill={s.color}
            fillOpacity={series.length > 1 ? 0.45 : 0.8}
            stroke={s.color}
            strokeOpacity={0.95}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        );
      })}

      {/* Axis labels */}
      {axes.map((label, i) => {
        const p = pointAt(i, n, 1);
        const lx = CENTRE + p.cos * (RADIUS + LABEL_GAP);
        const ly = CENTRE + p.sin * (RADIUS + LABEL_GAP);
        const anchor =
          Math.abs(p.cos) < 0.15 ? "middle" : p.cos > 0 ? "start" : "end";
        // Nudge so labels clear the outer ring rather than sitting on it.
        const dy = p.sin < -0.5 ? "-0.1em" : p.sin > 0.5 ? "0.8em" : "0.35em";
        return (
          <text
            key={label}
            x={lx}
            y={ly}
            dy={dy}
            textAnchor={anchor}
            fill="currentColor"
            fontSize={17}
            className="font-medium"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/** Coloured-dot legend row, matching the chart series colours. */
export function RadarLegend({ series }: { series: RadarSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {series.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-2 text-sm">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ background: s.color }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}
