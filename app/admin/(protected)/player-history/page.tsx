import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { Pagination } from "@/components/admin/Pagination";
import { LiveRefresh } from "@/components/LiveRefresh";
import { deletePlayerHistory } from "./actions";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type Spell = {
  history_id: string;
  player_id: string;
  season: string | null;
  role: string | null;
  joined_date: string | null;
  left_date: string | null;
  notes: string | null;
  player: { first_name: string; last_name: string } | null;
  team: { team_id: string; name: string; logo_url: string | null } | null;
};

function Crest({ name, logo, size = 20 }: { name: string; logo: string | null; size?: number }) {
  const px = `${size}px`;
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" style={{ width: px, height: px }} className="rounded-full object-cover shrink-0" />;
  }
  return (
    <span
      style={{ width: px, height: px }}
      className="rounded-full bg-slate-200 text-[9px] font-semibold text-slate-600 grid place-items-center shrink-0"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

export default async function PlayerHistoryPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const q = (first(searchParams?.q) ?? "").trim();
  const selectedClub = first(searchParams?.club) || "";
  const page = Math.max(1, parseInt(first(searchParams?.page) ?? "1", 10) || 1);
  const perPage = 10;

  // A career is only legible whole, so the spells are grouped rather than
  // paged as rows — the paging below is by player.
  const { data, error } = await supabase
    .from("player_history")
    .select(
      "history_id, player_id, season, role, joined_date, left_date, notes, player:player_id(first_name, last_name), team:team_id(team_id, name, logo_url)"
    )
    .order("season", { ascending: true })
    .limit(5000);

  const spells = (data ?? []) as unknown as Spell[];

  const byPlayer = new Map<string, Spell[]>();
  for (const s of spells) {
    const list = byPlayer.get(s.player_id) ?? [];
    list.push(s);
    byPlayer.set(s.player_id, list);
  }

  type Career = {
    player_id: string;
    name: string;
    spells: Spell[];
    movedAt: Set<string>;
    clubs: number;
    span: string;
    current: Spell | null;
  };

  let careers: Career[] = Array.from(byPlayer).map(([player_id, rows]) => {
    // Chronological first: a move can only be seen against the season before
    // it. The list is reversed afterwards for display.
    const ordered = [...rows].sort((a, b) => (a.season ?? "").localeCompare(b.season ?? ""));
    const clubSpells = ordered.filter((s) => s.role !== "Representative");
    const seasons = ordered.map((s) => s.season).filter(Boolean) as string[];
    const p = ordered[0]?.player;
    const movedAt = new Set<string>();
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const cur = ordered[i];
      if (
        cur.role !== "Representative" &&
        prev.role !== "Representative" &&
        prev.team?.name !== cur.team?.name
      ) {
        movedAt.add(cur.history_id);
      }
    }

    return {
      player_id,
      name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "—",
      // Newest first: the season that matters most is the one just gone.
      spells: [...ordered].reverse(),
      movedAt,
      clubs: new Set(clubSpells.map((s) => s.team?.name).filter(Boolean)).size,
      span:
        seasons.length === 0
          ? "—"
          : seasons[0] === seasons[seasons.length - 1]
          ? seasons[0]
          : `${seasons[0]}–${seasons[seasons.length - 1]}`,
      current: clubSpells[clubSpells.length - 1] ?? null,
    };
  });

  if (q) {
    const needle = q.toLowerCase();
    careers = careers.filter((c) => c.name.toLowerCase().includes(needle));
  }
  if (selectedClub) {
    careers = careers.filter((c) => c.spells.some((s) => s.team?.name === selectedClub));
  }

  // Longest careers first — the ones with something to show.
  careers.sort((a, b) => b.spells.length - a.spells.length || a.name.localeCompare(b.name));

  const clubs = Array.from(
    new Set(spells.map((s) => s.team?.name).filter(Boolean) as string[])
  ).sort();

  const total = careers.length;
  const visible = careers.slice((page - 1) * perPage, page * perPage);
  const isFiltered = q || selectedClub;

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["player_history"]} />
      <ListHeader title="Club History" addHref="/admin/player-history/new" addLabel="Add Spell" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        Where each player has been, season by season. A registration records who
        is signed on for one year; this is the career behind it — the spells,
        the moves, and the years before.
      </p>

      <form className="mb-5 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm flex-1 min-w-[12rem]">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Search player</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Player name…"
            className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500"
          />
        </label>
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Club</span>
          <select
            name="club"
            defaultValue={selectedClub}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[11rem]"
          >
            <option value="">All clubs</option>
            {clubs.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Search
        </button>
        {isFiltered && (
          <Link href="/admin/player-history" className="text-xs text-slate-500 hover:underline">clear</Link>
        )}
        <span className="text-xs text-slate-400 ml-auto">
          {total} player{total === 1 ? "" : "s"}
        </span>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-500">
          {spells.length === 0 ? (
            <>
              No club history recorded.{" "}
              <Link href="/admin/player-history/new" className="text-navy-700 hover:underline">
                Record a spell →
              </Link>
            </>
          ) : (
            "No players match that search."
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 items-start">
          {visible.map((c) => {
            const [latest, ...earlier] = c.spells;
            const initials = c.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

            const Row = ({ s, dim }: { s: Spell; dim?: boolean }) => {
              const rep = s.role === "Representative";
              const inferred = (s.notes ?? "").includes("from scoring records");
              return (
                <li className="group/row flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                  <span className={`w-10 shrink-0 text-xs font-medium tabular-nums ${dim ? "text-slate-400" : "text-navy-900"}`}>
                    {s.season ?? "—"}
                  </span>
                  <span className="flex items-center gap-2 min-w-0 flex-1">
                    {s.team && <Crest name={s.team.name} logo={s.team.logo_url} />}
                    <span className={`truncate text-sm ${rep ? "text-slate-500 italic" : dim ? "text-slate-600" : "text-navy-900 font-medium"}`}>
                      {s.team?.name ?? "—"}
                    </span>
                    {c.movedAt.has(s.history_id) && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-navy-50 text-navy-700 border border-navy-100 shrink-0">
                        moved
                      </span>
                    )}
                    {rep && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gold-50 text-gold-800 border border-gold-200 shrink-0">
                        call-up
                      </span>
                    )}
                    {inferred && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                        title="No team sheet behind this spell — built from the scoring record"
                      />
                    )}
                  </span>
                  <span className="flex items-center gap-2 shrink-0 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
                    <Link href={`/admin/player-history/${s.history_id}`} className="text-navy-700 hover:underline text-xs">
                      Edit
                    </Link>
                    <DeleteRowButton id={s.history_id} action={deletePlayerHistory} label="✕" />
                  </span>
                </li>
              );
            };

            const head = (
              <>
                <div className="w-10 h-10 rounded-full bg-navy-900 text-white grid place-items-center font-display text-sm shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-navy-900 block truncate">{c.name}</span>
                  <span className="text-xs text-slate-500">
                    {c.span}
                    {c.clubs > 1 && <> · <span className="text-navy-700 font-medium">{c.clubs} clubs</span></>}
                    {earlier.length > 0 && <> · {c.spells.length} seasons</>}
                  </span>
                </div>
              </>
            );

            // Nothing to open when the career is a single season.
            if (earlier.length === 0) {
              return (
                <article key={c.player_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-start gap-3 px-4 pt-4 pb-3">{head}</div>
                  <ol className="border-t border-slate-100">
                    <Row s={latest} />
                  </ol>
                </article>
              );
            }

            return (
              <details
                key={c.player_id}
                className="group bg-white border border-slate-200 rounded-xl overflow-hidden open:border-navy-300"
              >
                {/* The summary carries the newest season, so a shut card still
                    answers where the player is now. */}
                <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                  <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                    {head}
                    <span className="text-slate-400 text-xs shrink-0 mt-1 transition-transform group-open:rotate-180">
                      ▾
                    </span>
                  </div>
                  <ol className="border-t border-slate-100">
                    <Row s={latest} />
                  </ol>
                  <p className="px-4 py-1.5 text-[11px] text-slate-400 border-t border-slate-50 group-open:hidden">
                    {earlier.length} earlier season{earlier.length === 1 ? "" : "s"} — click to open
                  </p>
                </summary>

                <ol className="border-t border-slate-100 divide-y divide-slate-50">
                  {earlier.map((s) => (
                    <Row key={s.history_id} s={s} dim />
                  ))}
                </ol>
              </details>
            );
          })}
        </div>
      )}

      <Pagination page={page} pageSize={perPage} total={total} />
    </div>
  );
}
