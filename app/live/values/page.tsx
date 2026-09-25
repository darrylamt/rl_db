import Link from "next/link";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { Pagination } from "@/components/admin/Pagination";
import {
  getValueMovement,
  type MovementPeriod,
  type ValueGroup,
  type ValueGrade,
} from "@/lib/playerValue";
import { getClubValues } from "@/lib/clubValue";
import { getSeasonState } from "@/lib/seasons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Values — RLFG Live",
  description:
    "What every club and player is worth, worked out from the recorded record.",
};

/**
 * Four ladders, not three.
 *
 * This still said "youth" after youth was split into boys and girls, and
 * since every youth player carries a gender none of them matched it any
 * more — the tab was there and 264 players were behind it, unreachable.
 */
const GRADES: { key: ValueGrade; label: string }[] = [
  { key: "senior_men", label: "Men" },
  { key: "senior_women", label: "Women" },
  { key: "youth_boys", label: "Youth Boys" },
  { key: "youth_girls", label: "Youth Girls" },
];

const GROUPS: { key: ValueGroup | "all"; label: string }[] = [
  { key: "all", label: "Every position" },
  { key: "spine", label: "Spine" },
  { key: "outside", label: "Outside backs" },
  { key: "forward", label: "Forwards" },
  { key: "utility", label: "Unlisted" },
];

/** What each value is compared against, to show who has risen and fallen. */
const PERIODS: { key: MovementPeriod; label: string }[] = [
  { key: "matchday", label: "Last matchday" },
  { key: "30d", label: "30 days" },
  { key: "season", label: "This season" },
];

const SORTS = [
  { key: "value", label: "Highest value" },
  { key: "rising", label: "Biggest risers" },
  { key: "falling", label: "Biggest fallers" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

const PAGE_SIZE = 25;

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default async function ValuesPage({
  searchParams,
}: {
  searchParams?: {
    view?: string;
    grade?: string;
    group?: string;
    page?: string;
    q?: string;
    since?: string;
    sort?: string;
  };
}) {
  const supabase = createPublicClient();
  const view = searchParams?.view === "clubs" ? "clubs" : "players";
  const since = (PERIODS.find((p) => p.key === searchParams?.since)?.key ??
    "matchday") as MovementPeriod;
  const sort = (SORTS.find((s) => s.key === searchParams?.sort)?.key ??
    "value") as SortKey;

  // Each of these reads the whole record, so only the tab being looked at
  // is worked out.
  const season = view === "players" && since === "season" ? await getSeasonState() : null;
  const [movement, clubValues, { data: players }, { data: teams }] = await Promise.all([
    view === "players" ? getValueMovement(since, season?.row?.startsOn) : null,
    view === "clubs" ? getClubValues() : Promise.resolve([]),
    supabase
      .from("public_players")
      .select("player_id, first_name, last_name, position, photo_url, team_id")
      .limit(1000),
    supabase.from("teams").select("team_id, name, logo_url"),
  ]);

  const club = new Map(((teams ?? []) as any[]).map((t) => [t.team_id, t]));

  const grade = (GRADES.find((g) => g.key === searchParams?.grade)?.key ??
    "senior_men") as ValueGrade;
  const group = (GROUPS.find((g) => g.key === searchParams?.group)?.key ??
    "all") as ValueGroup | "all";
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);
  const q = (searchParams?.q ?? "").trim();

  const values = movement?.now ?? new Map();
  const then = movement?.then ?? new Map();

  // The change is the value now less the value the record gave the same
  // player at the start of the period. Null when there was nothing to
  // compare with, so "no change" and "no comparison" read differently.
  const withValue = ((players ?? []) as any[])
    .map((p) => {
      const v = values.get(p.player_id);
      const was = then.get(p.player_id);
      return {
        ...p,
        v,
        change: v && was && movement?.asOf ? v.value - was.value : null,
      };
    })
    .filter((r) => r.v);

  // Deliberately not filtered on playing_status. Every women's and youth
  // player on the register is marked inactive — a leftover of how they were
  // imported rather than a statement that they have stopped playing — and
  // filtering on it hid all 336 of them.
  const inGrade = withValue.filter((r) => r.v.grade === grade);

  // A name search looks across every ladder. Somebody typing a name is asking
  // where that player is, not where they are within the grade tab that
  // happened to be open — and five hundred players is too many to find
  // anybody by paging through the one you guessed right.
  const needle = q.toLowerCase();
  const rows = (q
    ? withValue.filter((r) =>
        `${r.first_name ?? ""} ${r.last_name ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
    : inGrade.filter((r) => group === "all" || r.v.group === group)
  ).sort((a, b) =>
    sort === "rising"
      ? (b.change ?? 0) - (a.change ?? 0) || b.v.value - a.v.value
      : sort === "falling"
      ? (a.change ?? 0) - (b.change ?? 0) || b.v.value - a.v.value
      : b.v.value - a.v.value
  );

  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const offset = (page - 1) * PAGE_SIZE;

  const href = (next: {
    grade?: ValueGrade;
    group?: string;
    since?: MovementPeriod;
    sort?: SortKey;
  }) => {
    const p = new URLSearchParams();
    const g = next.grade ?? grade;
    const gr = "group" in next ? next.group : group;
    const si = next.since ?? since;
    const so = next.sort ?? sort;
    if (g !== "senior_men") p.set("grade", g);
    if (gr && gr !== "all") p.set("group", gr);
    if (si !== "matchday") p.set("since", si);
    if (so !== "value") p.set("sort", so);
    const built = p.toString();
    return built ? `/live/values?${built}` : "/live/values";
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl leading-tight">
          {view === "clubs" ? "Club values" : "Player values"}
        </h1>
        {view === "players" && (
          <p className="text-slate-400 text-sm mt-2 max-w-2xl">
            What the record says each player is worth, measured against others
            in the same competition and position. A short record counts for
            less than a long one, so nobody is judged on a single afternoon.
          </p>
        )}
      </div>

      <div className="flex gap-1.5 mb-5">
        {[
          { key: "players", label: "Players" },
          { key: "clubs", label: "Clubs" },
        ].map((v) => (
          <Link
            key={v.key}
            href={v.key === "players" ? "/live/values" : "/live/values?view=clubs"}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
              view === v.key
                ? "bg-white text-black border-white"
                : "border-white/15 text-slate-300 hover:border-white/40"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {view === "clubs" && (
        <>
          <p className="text-slate-400 text-sm mb-5 max-w-2xl">
            A club is worth what it puts into the game, not what its first team
            did last Sunday. Running men&apos;s, women&apos;s and youth sides
            season after season counts for more here than a good year — which
            is why the club with the best record is not the one at the top.
          </p>
          <ol className="space-y-2">
            {clubValues.map((c, i) => (
              <li key={c.teamId}>
                <Link
                  href={`/live/club/${c.teamId}`}
                  className="block bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 hover:border-white/25 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-center font-display tabular-nums text-sm text-slate-500">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">
                        {c.name}
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {c.gradesFielded.length} grade
                        {c.gradesFielded.length === 1 ? "" : "s"} ·{" "}
                        {c.seasons} season{c.seasons === 1 ? "" : "s"} ·{" "}
                        {c.won}/{c.played} won
                      </span>
                    </span>
                    <span className="font-display text-xl text-ghanaYellow-500 tabular-nums shrink-0">
                      {c.value}
                      <span className="text-xs ml-1 text-ghanaYellow-500/70">LX</span>
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      ["Breadth", c.parts.breadth],
                      ["Squad", c.parts.squad],
                      ["Continuity", c.parts.continuity],
                      ["Record", c.parts.record],
                    ].map(([label, v]) => (
                      <div key={label as string}>
                        <dt className="text-[10px] uppercase tracking-wider text-slate-500">
                          {label as string}
                        </dt>
                        <dd className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <span
                            className="block h-full rounded-full bg-ghanaYellow-500/70"
                            style={{ width: `${Math.round((v as number) * 100)}%` }}
                          />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}

      {view === "players" && (
      <>
      {/* The women's game has nine recorded matches to the men's two hundred,
          so these are separate ladders rather than one. */}
      {/* A plain GET form: no JavaScript needed, and the result is a URL
          somebody can send to somebody else. */}
      <form action="/live/values" className="flex gap-2 mb-4">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search every player by name"
          aria-label="Search players by name"
          className="flex-1 min-w-0 bg-neutral-900 border border-white/10 rounded-full px-4 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-white/30"
        />
        <button className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium shrink-0">
          Search
        </button>
        {q && (
          <Link
            href="/live/values"
            className="px-4 py-2 rounded-full border border-white/15 text-slate-300 text-sm shrink-0 hover:border-white/40"
          >
            Clear
          </Link>
        )}
      </form>

      {q ? (
        <p className="text-sm text-slate-400 mb-4">
          {rows.length === 0
            ? `Nobody matches “${q}”.`
            : `${rows.length} player${rows.length === 1 ? "" : "s"} matching “${q}”, across every grade.`}
        </p>
      ) : (
      <div className="flex bg-neutral-900 border border-white/10 rounded-full p-1 mb-3 max-w-sm">
        {GRADES.map((g) => {
          const on = grade === g.key;
          const n = withValue.filter((r) => r.v.grade === g.key).length;
          return (
            <Link
              key={g.key}
              href={href({ grade: g.key, group: "all" })}
              className={`flex-1 text-center text-sm font-medium rounded-full py-1.5 transition ${
                on ? "bg-white text-black" : "text-slate-300 hover:text-white"
              }`}
            >
              {g.label}
              {n > 0 && (
                <span
                  className={`ml-1.5 text-xs tabular-nums ${
                    on ? "text-black/50" : "text-slate-500"
                  }`}
                >
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      )}

      {!q && (
      <div className="flex gap-1.5 flex-wrap mb-6">
        {GROUPS.filter(
          (g) =>
            g.key === "all" ||
            inGrade.some((r) => r.v.group === g.key)
        ).map((g) => {
          const on = group === g.key;
          return (
            <Link
              key={g.key}
              href={href({ group: g.key })}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                on
                  ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-semibold"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {g.label}
            </Link>
          );
        })}
      </div>
      )}

      {/* Rise and fall: against what, and in what order. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-5 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500 mr-1">Change since</span>
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={href({ since: p.key })}
              className={`px-2.5 py-1 rounded-full border transition ${
                since === p.key
                  ? "bg-white text-black border-white font-medium"
                  : "border-white/10 text-slate-300 hover:border-white/30"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>
        {!q && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 mr-1">Sort</span>
            {SORTS.map((o) => (
              <Link
                key={o.key}
                href={href({ sort: o.key })}
                className={`px-2.5 py-1 rounded-full border transition ${
                  sort === o.key
                    ? "bg-white text-black border-white font-medium"
                    : "border-white/10 text-slate-300 hover:border-white/30"
                }`}
              >
                {o.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500 -mt-3 mb-5">
        {movement?.asOf
          ? `Compared with each player's value before ${shortDate(movement.asOf)}.`
          : since === "season"
          ? "No season start date is set, so there is nothing to compare with yet."
          : "Nothing has been played yet to compare with."}
      </p>

      {rows.length === 0 ? (
        <p className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-10 text-center text-slate-400 text-sm">
          {q ? "Try part of a name, or clear the search." : "Nobody to value here yet."}
        </p>
      ) : (
        <>
          <ol className="space-y-2">
            {shown.map((r, i) => {
              const t = r.team_id ? club.get(r.team_id) : null;
              const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
              return (
                <li key={r.player_id}>
                  <Link
                    href={`/live/player/${r.player_id}`}
                    className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/25 transition"
                  >
                    <span className="w-7 shrink-0 text-center font-display tabular-nums text-sm text-slate-500">
                      {offset + i + 1}
                    </span>

                    <Avatar
                      src={r.photo_url}
                      name={name}
                      size={40}
                      rounded="none"
                      className="rounded-xl"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">
                        {name}
                      </span>
                      <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                        {t?.logo_url && (
                          <Avatar src={t.logo_url} name={t.name} size={14} contain />
                        )}
                        <span className="text-[11px] text-slate-500 truncate">
                          {/* The grade only earns its place while searching:
                              a search crosses all four ladders, so without it
                              a men's row and a youth row look identical. */}
                          {[
                            t?.name,
                            r.position,
                            q
                              ? GRADES.find((g) => g.key === r.v.grade)?.label
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No club"}
                        </span>
                      </span>
                    </span>

                    <span className="text-right shrink-0">
                      <span className="block font-display text-xl text-ghanaYellow-500 tabular-nums leading-none">
                        {r.v.value}
                        <span className="text-xs ml-1 text-ghanaYellow-500/70">LX</span>
                      </span>
                      {r.change != null && (
                        <span
                          className={`block text-[11px] font-medium tabular-nums mt-1 ${
                            r.change > 0
                              ? "text-emerald-400"
                              : r.change < 0
                              ? "text-red-400"
                              : "text-slate-500"
                          }`}
                          title={
                            r.change === 0
                              ? "No change"
                              : `${r.change > 0 ? "Up" : "Down"} ${Math.abs(r.change)} LX`
                          }
                        >
                          {r.change > 0 ? "▲" : r.change < 0 ? "▼" : "–"}
                          {r.change !== 0 && ` ${Math.abs(r.change)} LX`}
                        </span>
                      )}
                      <span
                        className={`block text-[10px] mt-0.5 ${
                          r.v.confidence === "good"
                            ? "text-emerald-400/80"
                            : r.v.confidence === "fair"
                            ? "text-slate-500"
                            : "text-amber-400/80"
                        }`}
                      >
                        {r.v.appearances} app{r.v.appearances === 1 ? "" : "s"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {rows.length > PAGE_SIZE && (
            <Pagination tone="dark" page={page} pageSize={PAGE_SIZE} total={rows.length} />
          )}
        </>
      )}

      </>
      )}

      <p className="text-xs text-slate-500 mt-8">
        Worked out from recorded match data — scoring, game time and the
        strength of the sides a player actually played in.{" "}
        <Link href="/live/records" className="text-ghanaYellow-500 hover:underline">
          The record book
        </Link>
      </p>
    </>
  );
}
