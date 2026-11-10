import type { ReactNode } from "react";

/**
 * The card every Insights chart sits in: a title that says what is plotted,
 * the chart, and its table view underneath.
 *
 * The table is the chart's twin, not an extra. A hover tooltip is never the
 * only way to read a number, and two of the chart colours are faint on white,
 * so every value is also here in plain figures.
 */
export function ChartCard({
  title,
  subtitle,
  children,
  table,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  table?: { columns: string[]; rows: (string | number)[][] };
  className?: string;
}) {
  return (
    <figure
      className={`viz-root bg-white border border-slate-200 rounded-lg p-5 min-w-0 flex flex-col ${className}`}
    >
      <figcaption>
        <h2 className="font-display text-lg text-navy-900 leading-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </figcaption>

      <div className="mt-4 flex-1 min-w-0">{children}</div>

      {table && table.rows.length > 0 && (
        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="text-xs text-slate-500 hover:text-navy-900 cursor-pointer select-none w-fit">
            Show table
          </summary>
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-500">
                  {table.columns.map((c, i) => (
                    <th
                      key={c}
                      className={`font-medium py-1.5 ${i === 0 ? "text-left pr-3" : "text-right pl-3"}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {table.rows.map((row, r) => (
                  <tr key={r}>
                    {row.map((cell, i) => (
                      <td
                        key={i}
                        className={`py-1.5 ${i === 0 ? "text-left pr-3 text-slate-700" : "text-right pl-3 text-slate-900"}`}
                      >
                        {typeof cell === "number" ? cell.toLocaleString("en-GB") : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}

/** A note in place of a chart, when there is nothing to plot yet. */
export function ChartEmpty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500 py-6">{children}</p>;
}
