import Link from "next/link";
import type { Metadata } from "next";
import { getRecords, type RecordBoard } from "@/lib/records";
import { Avatar } from "@/components/Avatar";
import { formatLabel, divisionLabel } from "@/lib/competitionFormat";

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
      className="w-5 h-5 text-slate-600 shrink-0 transition-transform duration-150 group-open:rotate-90"
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
    <details className="group bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition [&_summary::-webkit-details-marker]:hidden">
      <summary className="list-none cursor-pointer px-5 pt-5 pb-2 flex items-center gap-2 select-none">
        <span className="text-lg md:text-xl font-bold truncate">
          {board.title}
        </span>
        <Chevron />
      </summary>

      <div className="px-5 pb-5">
        {board.note && (
          <p className="text-[11px] text-slate-400 mb-2">{board.note}</p>
        )}

        <div className="text-5xl md:text-6xl font-extrabold text-ghanaYellow-500 tabular-nums leading-none mb-4">
          {leader.count}
        </div>

        <div className="flex items-center gap-3">
          <Avatar
            src={leader.photoUrl ?? leader.clubLogo}
            name={leader.name}
            size={56}
            rounded="none"
            className="rounded-2xl"
            contain={!leader.photoUrl}
          />
          <div className="min-w-0">
            <p className="font-bold text-[15px] truncate">{leader.name}</p>
            {leader.subtitle && (
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                {leader.clubLogo && (
                  <Avatar
                    src={leader.clubLogo}
                    name={leader.subtitle}
                    size={18}
                    rounded="full"
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
          <ol className="mt-4 pt-3 border-t border-white/10 divide-y divide-white/5">
            {rest.map((l) => (
              <li
                key={l.id}
                className="py-1.5 flex items-center gap-2.5 text-sm"
              >
                <span className="w-5 shrink-0 text-center text-slate-500 tabular-nums text-xs">
                  {l.place}
                </span>
                <span className="flex-1 min-w-0 truncate text-slate-300">
                  {l.name}
                </span>
                <span className="tabular-nums font-semibold shrink-0">
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

function Chip({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border transition-colors ${
        on
          ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-semibold"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2">
      <span className="text-[10px] uppercase tracking-widest text-slate-500 w-full sm:w-20 shrink-0">
        {label}
      </span>
      <div className="flex gap-1.5 flex-wrap min-w-0">{children}</div>
    </div>
  );
}

export default async function RecordsPage({
  searchParams,
}: {
  searchParams?: { season?: string; format?: string; division?: string };
}) {
  const pick = (v?: string) => (v && v !== "all" ? v : null);
  const season = pick(searchParams?.season);
  const format = pick(searchParams?.format);
  const division = pick(searchParams?.division);

  const records = await getRecords(season, format, division);
  const nothing =
    records.playerBoards.length === 0 && records.clubBoards.length === 0;

  // Changing one filter keeps the others, so narrowing to the 9s does not throw
  // away the season you were already looking at.
  const href = (next: {
    season?: string | null;
    format?: string | null;
    division?: string | null;
  }) => {
    const p = new URLSearchParams();
    const s = "season" in next ? next.season : season;
    const f = "format" in next ? next.format : format;
    const d = "division" in next ? next.division : division;
    if (s) p.set("season", s);
    if (f) p.set("format", f);
    if (d) p.set("division", d);
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
          Every figure here is counted from recorded match data, so it moves as
          the season does.
        </p>
      </div>

      {/* Everything is combined unless you ask otherwise: a 9s try and a 13s
          try are not the same feat, and neither are a men's and a youth one.
          Folded away, because three rows of chips before a single record is
          a lot of furniture in front of the thing people came for. */}
      <details
        className="group bg-neutral-900 border border-white/10 rounded-xl mb-6 [&_summary::-webkit-details-marker]:hidden"
        open={!!(season || format || division)}
      >
        <summary className="list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-300">
            {[
              divisionLabel(division),
              formatLabel(format),
              season ?? "All time",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="text-[11px] text-slate-500 group-open:hidden">
            Change
          </span>
          <span className="text-[11px] text-slate-500 hidden group-open:inline">
            Done
          </span>
        </summary>
        <div className="px-3 md:px-4 pb-4 grid gap-3">
        <FilterRow label="Season">
          <Chip href={href({ season: null })} on={!season}>
            All time
          </Chip>
          {records.seasons.map((s) => (
            <Chip key={s} href={href({ season: s })} on={season === s}>
              <span className="tabular-nums">{s}</span>
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Division">
          <Chip href={href({ division: null })} on={!division}>
            All
          </Chip>
          {records.divisions.map((d) => (
            <Chip
              key={d.key}
              href={href({ division: d.key })}
              on={division === d.key}
            >
              {d.label}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Competition">
          <Chip href={href({ format: null })} on={!format}>
            All
          </Chip>
          {records.formats.map((f) => (
            <Chip
              key={f.key}
              href={href({ format: f.key })}
              on={format === f.key}
            >
              {f.label}
            </Chip>
          ))}
        </FilterRow>
        </div>
      </details>

      {nothing ? (
        <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-10 text-center text-slate-400 text-sm">
          {[
            "No",
            records.divisions.find((d) => d.key === division)?.label,
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
        Counted from recorded match data.{" "}
        <Link href="/live" className="text-ghanaYellow-500 hover:underline">
          Back to the scores
        </Link>
      </p>
    </>
  );
}
