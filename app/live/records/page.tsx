import Link from "next/link";
import type { Metadata } from "next";
import { getRecords, type RecordBoard } from "@/lib/records";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Records — RLFG Live",
  description:
    "All-time and season records for Rugby League Federation Ghana — tries, points, tackles, appearances and club records.",
};

function Board({ board }: { board: RecordBoard }) {
  const top = board.leaders[0]?.count ?? 0;

  return (
    <section className="bg-neutral-900 border border-white/10 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="font-display text-lg">{board.title}</h2>
        {board.note && (
          <p className="text-[11px] text-slate-500 mt-0.5">{board.note}</p>
        )}
      </div>
      <ol className="divide-y divide-white/5">
        {board.leaders.map((l) => (
          <li key={l.id} className="px-4 py-2.5 flex items-center gap-3">
            <span
              className={`w-6 shrink-0 text-center font-display tabular-nums text-sm ${
                l.place === 1 ? "text-ghanaYellow-500" : "text-slate-600"
              }`}
            >
              {l.place}
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{l.name}</span>
              {l.subtitle && (
                <span className="block text-[11px] text-slate-500 truncate">
                  {l.subtitle}
                </span>
              )}
            </span>

            {/* A bar against the leader, so the gap reads without arithmetic. */}
            <span className="hidden sm:block w-24 h-1.5 rounded-full bg-white/5 overflow-hidden shrink-0">
              <span
                className={`block h-full rounded-full ${
                  l.place === 1 ? "bg-ghanaYellow-500" : "bg-white/25"
                }`}
                style={{ width: `${top ? Math.round((l.count / top) * 100) : 0}%` }}
              />
            </span>

            <span className="font-display tabular-nums text-lg shrink-0 w-12 text-right">
              {l.count}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: { season?: string };
}) {
  const season = searchParams?.season && searchParams.season !== "all"
    ? searchParams.season
    : null;

  const records = await getRecords(season);
  const nothing =
    records.playerBoards.length === 0 && records.clubBoards.length === 0;

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
      <div className="flex gap-1.5 flex-wrap mb-6">
        <Link
          href="/live/records"
          className={`px-3 py-1.5 rounded-lg text-sm border ${
            !season
              ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-medium"
              : "border-white/15 text-slate-300 hover:border-white/40"
          }`}
        >
          All time
        </Link>
        {records.seasons.map((s) => (
          <Link
            key={s}
            href={`/live/records?season=${s}`}
            className={`px-3 py-1.5 rounded-lg text-sm border tabular-nums ${
              season === s
                ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-medium"
                : "border-white/15 text-slate-300 hover:border-white/40"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {nothing ? (
        <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
          Nothing recorded for {season ?? "any season"} yet.
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
          <div className="grid gap-3 md:grid-cols-2 mb-8">
            {records.playerBoards.map((b) => (
              <Board key={b.key} board={b} />
            ))}
          </div>

          <h2 className="font-display text-xl mb-3">Clubs</h2>
          <div className="grid gap-3 md:grid-cols-2">
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
