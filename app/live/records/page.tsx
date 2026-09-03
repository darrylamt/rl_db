import Link from "next/link";
import type { Metadata } from "next";
import { getRecords, type RecordBoard } from "@/lib/records";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Records — RLFG Live",
  description:
    "All-time and season records for Rugby League Federation Ghana — tries, points, tackles, appearances and club records.",
};

function Chevron() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="w-4 h-4 text-navy-300 shrink-0 transition-transform duration-150 group-open:rotate-90"
    >
      <path
        d="M7 4l6 6-6 6"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Board({ board }: { board: RecordBoard }) {
  const leader = board.leaders[0];
  const rest = board.leaders.slice(1);
  if (!leader) return null;

  return (
    <details className="group bg-white text-slate-900 rounded-2xl shadow-sm overflow-hidden [&_summary::-webkit-details-marker]:hidden">
      <summary className="list-none cursor-pointer px-4 py-3 flex items-center justify-between gap-2 select-none">
        <span className="font-display text-base tracking-wide text-navy-700 truncate">
          {board.title}
        </span>
        <Chevron />
      </summary>

      <div className="px-4 pb-4">
        {board.note && (
          <p className="text-[11px] text-slate-400 -mt-1 mb-2">{board.note}</p>
        )}

        <div className="font-display text-5xl font-bold tabular-nums leading-none mb-3">
          {leader.count}
        </div>

        <div className="flex items-center gap-3">
          <Avatar
            src={leader.photoUrl ?? leader.clubLogo}
            name={leader.name}
            size={48}
            rounded="md"
            contain={!leader.photoUrl}
          />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{leader.name}</p>
            {leader.subtitle && (
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                {leader.clubLogo && (
                  <Avatar
                    src={leader.clubLogo}
                    name={leader.subtitle}
                    size={16}
                    rounded="md"
                    contain
                  />
                )}
                <span className="text-xs text-slate-500 truncate">
                  {leader.subtitle}
                </span>
              </div>
            )}
          </div>
        </div>

        {rest.length > 0 && (
          <ol className="mt-4 pt-3 border-t border-slate-100 divide-y divide-slate-100">
            {rest.map((l) => (
              <li
                key={l.id}
                className="py-1.5 flex items-center gap-2.5 text-sm"
              >
                <span className="w-5 shrink-0 text-center text-slate-400 tabular-nums text-xs">
                  {l.place}
                </span>
                <span className="flex-1 min-w-0 truncate text-slate-700">
                  {l.name}
                </span>
                <span className="tabular-nums font-semibold text-slate-900 shrink-0">
                  {l.count}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}

const CHIP_ON =
  "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-medium";
const CHIP_OFF = "border-white/15 text-slate-300 hover:border-white/40";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: { season?: string; format?: string };
}) {
  const season = searchParams?.season && searchParams.season !== "all"
    ? searchParams.season
    : null;
  const format = searchParams?.format && searchParams.format !== "all"
    ? searchParams.format
    : null;

  const records = await getRecords(season, format);
  const nothing =
    records.playerBoards.length === 0 && records.clubBoards.length === 0;

  // Changing one filter keeps the other, so narrowing to the 9s does not throw
  // away the season you were already looking at.
  const href = (next: { season?: string | null; format?: string | null }) => {
    const p = new URLSearchParams();
    const s = "season" in next ? next.season : season;
    const f = "format" in next ? next.format : format;
    if (s) p.set("season", s);
    if (f) p.set("format", f);
    const query = p.toString();
    return query ? `/live/records?${query}` : "/live/records";
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl leading-tight">
          Records
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          Every figure here is counted from the matches as they were recorded,
          so it moves as the season does.
        </p>
      </div>

      {/* Season */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        <Link
          href={href({ season: null })}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            !season ? CHIP_ON : CHIP_OFF
          }`}
        >
          All time
        </Link>
        {records.seasons.map((s) => (
          <Link
            key={s}
            href={href({ season: s })}
            className={`px-3 py-1.5 rounded-lg text-sm border tabular-nums ${
              season === s ? CHIP_ON : CHIP_OFF
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Competition — combined unless you ask otherwise, because a 9s try and
          a 13s try are not the same feat. */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        <Link
          href={href({ format: null })}
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            !format ? CHIP_ON : CHIP_OFF
          }`}
        >
          All competitions
        </Link>
        {records.formats.map((f) => (
          <Link
            key={f.key}
            href={href({ format: f.key })}
            className={`px-3 py-1.5 rounded-lg text-sm border ${
              format === f.key ? CHIP_ON : CHIP_OFF
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {nothing ? (
        <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
          {[
            "No",
            records.formats.find((f) => f.key === format)?.label,
            season ? `match from ${season}` : "match",
            "has been recorded yet.",
          ]
            .filter(Boolean)
            .join(" ")}
        </p>
      ) : (
        <>
          {/* The shape of it */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            {records.totals.map((t) => (
              <div
                key={t.label}
                className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-3 text-center"
              >
                <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">
                  {t.label}
                </div>
                <div className="font-display text-2xl mt-1 tabular-nums">
                  {t.value}
                </div>
              </div>
            ))}
          </div>

          {records.matchFacts.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 mb-8">
              {records.matchFacts.map((f) => (
                <div
                  key={f.label}
                  className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-3"
                >
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">
                    {f.label}
                  </p>
                  <p className="font-display text-2xl text-ghanaYellow-500 tabular-nums leading-tight mt-0.5">
                    {f.value}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{f.detail}</p>
                </div>
              ))}
            </div>
          )}

          <h2 className="font-display text-xl mb-3">Players</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
            {records.playerBoards.map((b) => (
              <Board key={b.key} board={b} />
            ))}
          </div>

          <h2 className="font-display text-xl mb-1">Clubs</h2>
          <p className="text-slate-500 text-xs mb-3">
            Clubs only. The national sides and the President&apos;s XIII pick
            from every club in the league, so they are not ranked against them.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {records.clubBoards.map((b) => (
              <Board key={b.key} board={b} />
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-slate-500 mt-8">
        Counted from what has been recorded, which is not the same as
        everything that has happened — the further back you look, the less was
        written down.{" "}
        <Link href="/live" className="text-ghanaYellow-500 hover:underline">
          Back to the scores
        </Link>
      </p>
    </>
  );
}
