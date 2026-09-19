import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import type { Record_ } from "@/lib/officiating";

/**
 * The letters in the chip when there is no result to show.
 *
 * Built from the role itself rather than a list of the ones an official can
 * hold. The first version tested for "Referee" and fell through to TJ for
 * everything else, which put TJ against a coach's name on any match without
 * a score — including fixtures that have not been played.
 */
function initialsOf(role: string | null): string {
  if (!role) return "·";
  const words = role.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "·";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/**
 * A referee's or a coach's page.
 *
 * Built light by mistake the first time and dropped into /live, which is a
 * near-black page — so the name, the headings and every match title were dark
 * text on a dark ground and effectively invisible. It is the match centre's
 * palette now, the same as every other page under /live.
 *
 * The two are the same page with different words: a name, what they have
 * done, and every match behind it. A coach's record has a result to it, an
 * official's does not — nobody wins a match by refereeing it — so the win
 * column is only drawn when there is something to put in it.
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

  // A coach's tiles count played matches, not appointments. Listing a
  // fixture that has not kicked off yet is right — they are named for it —
  // but counting it made "Matches 9" sit above a won, drawn and lost that
  // added up to eight.
  const stats = showOutcomes
    ? [
        { label: "Played", value: decided },
        { label: "Won", value: won },
        { label: "Drawn", value: drawn },
        { label: "Lost", value: lost },
        { label: "Win rate", value: rate == null ? "—" : `${rate}%` },
      ]
    : [
        { label: "Matches", value: matches },
        {
          label: "Refereed",
          value: lines.filter((l) => l.role === "Referee").length,
        },
        {
          label: "On touch",
          value: lines.filter((l) => l.role === "Touch judge").length,
        },
      ];

  return (
    <div>
      <header className="flex items-center gap-4 mb-6">
        <Avatar src={photoUrl} name={name} size={64} />
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-ghanaYellow-500">
            {eyebrow}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold break-words leading-tight">
            {name}
          </h1>
          {meta.filter(Boolean).length > 0 && (
            <p className="text-sm text-slate-400 mt-0.5 break-words">
              {meta.filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </header>

      {/* Three across on a phone rather than two-and-an-orphan. */}
      <section
        className={`grid gap-2 mb-4 ${
          showOutcomes ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3"
        }`}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-neutral-900 border border-white/10 rounded-xl p-3 text-center"
          >
            <p className="font-display text-xl sm:text-2xl font-bold tabular-nums">
              {s.value}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </section>

      {caveat && (
        <p className="text-xs text-slate-400 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2.5 mb-5 leading-relaxed">
          {caveat}
        </p>
      )}

      <h2 className="font-display text-lg mb-2">
        {matches === 0 ? "No matches on record" : "Every match"}
        {matches > 0 && (
          <span className="text-slate-500 text-sm font-normal"> · {matches}</span>
        )}
      </h2>

      {matches === 0 ? (
        <p className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-10 text-center text-slate-400 text-sm">
          Nothing recorded yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.fixtureId}>
              {/* Two rows on purpose: the match on top, the context under it.
                  One row put the date, both clubs, the score and the role on
                  a phone-width line and everything got truncated to nothing. */}
              <Link
                href={`/live/${l.fixtureId}`}
                className="block bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/25 transition"
              >
                <div className="flex items-center gap-2.5">
                  {l.outcome ? (
                    <span
                      className={`w-6 h-6 rounded grid place-items-center text-[11px] font-bold shrink-0 ${
                        l.outcome === "won"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : l.outcome === "lost"
                            ? "bg-red-500/15 text-red-400"
                            : "bg-white/10 text-slate-400"
                      }`}
                    >
                      {l.outcome === "won"
                        ? "W"
                        : l.outcome === "lost"
                          ? "L"
                          : "D"}
                    </span>
                  ) : (
                    <span
                      className="w-6 h-6 rounded grid place-items-center text-[10px] font-bold shrink-0 bg-white/5 text-slate-500"
                      title={l.role ?? undefined}
                    >
                      {initialsOf(l.role)}
                    </span>
                  )}

                  <span className="min-w-0 flex-1 text-sm leading-tight">
                    {l.homeName} <span className="text-slate-500">v</span>{" "}
                    {l.awayName}
                  </span>

                  {l.homeScore != null && l.awayScore != null ? (
                    <span className="font-display tabular-nums shrink-0">
                      {l.homeScore}&ndash;{l.awayScore}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 shrink-0">
                      {l.date && l.date > new Date().toISOString().slice(0, 10)
                        ? "to come"
                        : "no result"}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 mt-1 pl-[2.1rem] break-words">
                  {[l.date, l.competition, l.season, l.role]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
