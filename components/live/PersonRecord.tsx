import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { Record_ } from "@/lib/officiating";

/**
 * A referee's or a coach's page.
 *
 * The two are the same page with different words: a name, what they have
 * done, and every match behind the number. A coach's record has a result to
 * it, an official's does not — nobody wins a match by refereeing it — so the
 * win column is only drawn when there is something to put in it.
 */
export function PersonRecord({
  name,
  photoUrl,
  eyebrow,
  meta,
  record,
  showOutcomes,
  caveat,
}: {
  name: string;
  photoUrl: string | null;
  eyebrow: string;
  /** Club, role, region — whatever is worth saying under the name. */
  meta: string[];
  record: Record_;
  /** Coaches win and lose; officials do not. */
  showOutcomes: boolean;
  caveat?: string;
}) {
  const { matches, won, lost, drawn, decided, lines } = record;
  const rate = decided > 0 ? Math.round((won / decided) * 100) : null;

  const stats = showOutcomes
    ? [
        { label: "Matches", value: matches },
        { label: "Won", value: won },
        { label: "Lost", value: lost },
        { label: "Drawn", value: drawn },
        { label: "Win rate", value: rate == null ? "—" : `${rate}%` },
      ]
    : [
        { label: "Matches", value: matches },
        {
          label: "As referee",
          value: lines.filter((l) => l.role === "Referee").length,
        },
        {
          label: "On touch",
          value: lines.filter((l) => l.role === "Touch judge").length,
        },
      ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-center gap-4 mb-6">
        <Avatar src={photoUrl} name={name} size={72} />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-ghanaYellow-600">
            {eyebrow}
          </p>
          <h1 className="font-display text-3xl font-bold text-navy-900 break-words">
            {name}
          </h1>
          {meta.filter(Boolean).length > 0 && (
            <p className="text-sm text-slate-500 mt-0.5">
              {meta.filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>

      <section
        className={`grid gap-2 mb-4 ${
          showOutcomes ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3"
        }`}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200 rounded-lg p-3 text-center"
          >
            <p className="font-display text-2xl font-bold text-navy-900 tabular-nums">
              {s.value}
            </p>
            <p className="text-[11px] uppercase tracking-wider text-slate-500">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {caveat && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2 mb-4">
          {caveat}
        </p>
      )}

      <h2 className="font-display text-lg text-navy-900 mb-2">
        {matches === 0
          ? "No matches on record"
          : `Every match${matches > 1 ? ` — ${matches}` : ""}`}
      </h2>

      {matches === 0 ? (
        <p className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
          {lines.map((l) => (
            <li key={l.fixtureId}>
              <Link
                href={`/live/${l.fixtureId}`}
                className="block px-4 py-2.5 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="text-slate-400 text-xs w-24 shrink-0 tabular-nums">
                    {l.date ?? "—"}
                  </span>
                  <span className="font-medium text-navy-900 flex-1 min-w-0">
                    {l.homeName} <span className="text-slate-400">v</span>{" "}
                    {l.awayName}
                  </span>
                  {l.homeScore != null && l.awayScore != null ? (
                    <span className="font-display tabular-nums text-navy-900 shrink-0">
                      {l.homeScore}&ndash;{l.awayScore}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 shrink-0">
                      no result
                    </span>
                  )}
                  {l.outcome && (
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                        l.outcome === "won"
                          ? "bg-emerald-100 text-emerald-800"
                          : l.outcome === "lost"
                            ? "bg-red-100 text-red-800"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {l.outcome}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {[l.competition, l.season, l.role].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
