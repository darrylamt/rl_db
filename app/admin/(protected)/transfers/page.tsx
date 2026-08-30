import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { createAdminClient } from "@/lib/supabase/server";
import { LiveRefresh } from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

type Spell = {
  player_id: string;
  season: string;
  role: string;
  joined_date: string | null;
  notes: string | null;
  player: { first_name: string; last_name: string } | null;
  team: { team_id: string; name: string; logo_url: string | null } | null;
};

type Move = {
  player_id: string;
  name: string;
  season: string;
  from: { name: string; logo: string | null };
  to: { name: string; logo: string | null };
  date: string | null;
  evidenced: boolean;
};

function Crest({ name, logo }: { name: string; logo: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <Avatar src={logo} name={name} size={20} />
      ) : (
        <Avatar src={null} name={name} size={20} />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

export default async function TransfersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createAdminClient();
  const selectedSeason = first(searchParams?.season) || "";
  const selectedClub = first(searchParams?.club) || "";

  // Every club spell, in season order. Representative call-ups are left out:
  // a week with the national side is a selection, not a move.
  const { data, error } = await supabase
    .from("player_history")
    .select(
      "player_id, season, role, joined_date, notes, player:player_id(first_name, last_name), team:team_id(team_id, name, logo_url)"
    )
    .eq("role", "Club")
    .order("season", { ascending: true })
    .limit(5000);

  const spells = (data ?? []) as unknown as Spell[];

  // A move is one club giving way to another between a player's seasons.
  const bySeason = new Map<string, Spell[]>();
  for (const s of spells) {
    const list = bySeason.get(s.player_id) ?? [];
    list.push(s);
    bySeason.set(s.player_id, list);
  }

  const moves: Move[] = [];
  for (const [player_id, rows] of Array.from(bySeason)) {
    const ordered = [...rows].sort((a, b) => a.season.localeCompare(b.season));
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const cur = ordered[i];
      if (!prev.team || !cur.team) continue;
      if (prev.team.name === cur.team.name) continue;
      // Two clubs inside one season is a loan or a correction, not a move
      // between seasons — still worth showing, and the season reads the same.
      moves.push({
        player_id,
        name: `${cur.player?.first_name ?? ""} ${cur.player?.last_name ?? ""}`.trim(),
        season: cur.season,
        from: { name: prev.team.name, logo: prev.team.logo_url },
        to: { name: cur.team.name, logo: cur.team.logo_url },
        date: cur.joined_date,
        // A spell with no team sheet behind it is thinner evidence, and the
        // move built on it inherits that.
        evidenced: !(cur.notes ?? "").includes("from scoring records"),
      });
    }
  }

  const seasons = Array.from(new Set(moves.map((m) => m.season))).sort((a, b) => b.localeCompare(a));
  const clubs = Array.from(
    new Set(moves.flatMap((m) => [m.from.name, m.to.name]))
  ).sort();

  const visible = moves.filter(
    (m) =>
      (!selectedSeason || m.season === selectedSeason) &&
      (!selectedClub || m.from.name === selectedClub || m.to.name === selectedClub)
  );

  // Newest first, and grouped so a season reads as one window.
  const grouped = Array.from(
    visible.reduce((acc, m) => {
      const list = acc.get(m.season) ?? [];
      list.push(m);
      acc.set(m.season, list);
      return acc;
    }, new Map<string, Move[]>())
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const busiest = Array.from(
    visible.reduce((acc, m) => {
      acc.set(m.to.name, (acc.get(m.to.name) ?? 0) + 1);
      return acc;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1])[0];

  const isFiltered = selectedSeason || selectedClub;

  return (
    <div className="p-4 md:p-8">
      <LiveRefresh tables={["player_history"]} />

      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-navy-900">Transfers</h1>
        <p className="text-slate-500 text-sm mt-1">
          Every change of club the record can evidence, read from a player&apos;s
          club history. A call-up to a national or President XIII side is a
          selection rather than a move, so it is not counted here.
        </p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Moves", value: visible.length },
          { label: "Players", value: new Set(visible.map((m) => m.player_id)).size },
          { label: "Seasons", value: new Set(visible.map((m) => m.season)).size },
          { label: "Most signings", value: busiest ? `${busiest[0]}` : "—", small: true },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className={`font-display font-bold text-navy-900 ${s.small ? "text-base mt-1.5" : "text-3xl"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <form className="mb-6 flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Season</span>
          <select
            name="season"
            defaultValue={selectedSeason}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm text-navy-900 min-w-[8rem]"
          >
            <option value="">All seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
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
          Filter
        </button>
        {isFiltered && (
          <Link href="/admin/transfers" className="text-xs text-slate-500 hover:underline">clear</Link>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500">
          {spells.length === 0 ? (
            <>
              No club history recorded yet, so there are no moves to show.{" "}
              <Link href="/admin/player-history" className="text-navy-700 hover:underline">
                Club History →
              </Link>
            </>
          ) : (
            "No moves match that filter."
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([season, list]) => (
            <section key={season}>
              <div className="flex items-baseline gap-3 mb-2">
                <h2 className="font-display text-lg font-bold text-navy-900">{season}</h2>
                <span className="text-xs text-slate-500">
                  {list.length} move{list.length === 1 ? "" : "s"}
                </span>
                <span className="flex-1 h-px bg-slate-200" />
              </div>

              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {list
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((m, i) => (
                    <div
                      key={`${m.player_id}-${m.season}-${i}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 hover:bg-slate-50"
                    >
                      <Link
                        href={`/admin/players/${m.player_id}/view`}
                        className="font-medium text-navy-900 hover:underline min-w-[10rem] flex-1"
                      >
                        {m.name || "—"}
                      </Link>

                      {/* from → to */}
                      <div className="flex items-center gap-2.5 text-sm text-slate-700 min-w-0">
                        <span className="text-slate-500 min-w-0 max-w-[10rem]">
                          <Crest name={m.from.name} logo={m.from.logo} />
                        </span>
                        <span aria-hidden className="text-slate-300">→</span>
                        <span className="font-medium min-w-0 max-w-[10rem]">
                          <Crest name={m.to.name} logo={m.to.logo} />
                        </span>
                      </div>

                      {!m.evidenced && (
                        <span
                          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                          title="This spell has no team sheet behind it — it is built from the scoring record alone"
                        >
                          from scoring
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
