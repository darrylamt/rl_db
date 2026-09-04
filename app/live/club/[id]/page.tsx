import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { MatchCard } from "@/app/live/MatchCard";
import { FIXTURE_SELECT } from "@/lib/matchStats";
import { readWithOptionalColumns } from "@/lib/optionalColumns";
import { GRADES, normaliseGrade } from "@/lib/grades";
import { formatOf, formatLabel, divisionLabel } from "@/lib/competitionFormat";

export const dynamic = "force-dynamic";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("teams")
    .select("name")
    .eq("team_id", params.id)
    .maybeSingle();
  if (!data) return { title: "Club — RLFG Live" };
  return { title: `${data.name} — RLFG Live` };
}

export default async function PublicClubPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createPublicClient();
  const teamId = params.id;
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: team }, { data: squad }, { data: fixtures }] =
    await Promise.all([
      supabase
        .from("teams")
        .select(
          "team_id, name, region, city, logo_url, founded_year, home_venue:home_venue_id(name)"
        )
        .eq("team_id", teamId)
        .eq("team_type", "club")
        .neq("is_public", false)
        .maybeSingle(),
      // category arrives with supabase/public_players_add_category.sql; until
      // it is run the squad simply shows as one list rather than breaking.
      readWithOptionalColumns(
        "player_id, first_name, last_name, jersey_number, position, is_captain, photo_url, category",
        ["category"],
        (columns) =>
          supabase
            .from("public_players")
            .select(columns)
            .eq("team_id", teamId)
            .eq("playing_status", "active")
            .order("jersey_number", { ascending: true, nullsFirst: false })
      ),
      supabase
        .from("fixtures")
        .select(`${FIXTURE_SELECT}, result:match_results(home_score, away_score)`)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("scheduled_date", { ascending: false })
        .limit(200),
    ]);

  if (!team) notFound();

  const homeVenue = one<any>((team as any).home_venue);

  const hasScore = (f: any) => {
    const r = one<any>(f.result);
    return !!r && ((r.home_score ?? 0) > 0 || (r.away_score ?? 0) > 0);
  };

  const all = (fixtures ?? []) as any[];
  const upcoming = all
    .filter((f) => f.status === "scheduled" && f.scheduled_date >= today)
    .sort((a, b) =>
      (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? "") ||
      (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? "")
    )
    .slice(0, 8);
  const recent = all.filter((f) => hasScore(f)).slice(0, 12);

  /**
   * What this club actually plays, and how it has gone in each.
   *
   * A club fields several sides, so one combined record says very little —
   * the 13s men and the 9s women are different teams wearing the same badge.
   * Grouped by format and division, every season together.
   */
  type Line = {
    key: string;
    label: string;
    division: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
  };
  const byLine = new Map<string, Line>();
  for (const f of all) {
    const comp = one<any>(f.competition);
    if (!comp?.name || !hasScore(f)) continue;
    const division = comp.division ?? "men";
    const label = formatLabel(formatOf(comp.name)) ?? comp.name;
    const key = `${label}__${division}`;
    if (!byLine.has(key)) {
      byLine.set(key, { key, label, division, played: 0, won: 0, drawn: 0, lost: 0 });
    }
    const line = byLine.get(key)!;
    const r = one<any>(f.result);
    const isHome = one<any>(f.home)?.team_id === teamId;
    const ours = isHome ? r.home_score : r.away_score;
    const theirs = isHome ? r.away_score : r.home_score;
    if (ours == null || theirs == null) continue;
    line.played += 1;
    if (ours > theirs) line.won += 1;
    else if (ours < theirs) line.lost += 1;
    else line.drawn += 1;
  }
  const lines = Array.from(byLine.values()).sort(
    (a, b) => b.played - a.played || a.label.localeCompare(b.label)
  );

  // Men, women and youth are different sides from the same club, so the squad
  // reads as three lists rather than one of eighty names.
  const squadRows = (squad ?? []) as any[];
  const graded = GRADES.map((g) => ({
    label: g.label,
    players: squadRows.filter((p) => normaliseGrade(p.category) === g.value),
  })).filter((g) => g.players.length > 0);
  const ungraded = squadRows.filter(
    (p) => !GRADES.some((g) => normaliseGrade(p.category) === g.value)
  );
  const squadGroups = [
    ...graded,
    ...(ungraded.length > 0
      ? [{ label: graded.length > 0 ? "Other" : "Squad", players: ungraded }]
      : []),
  ];

  return (
    <>
      <Link
        href="/live"
        className="inline-block text-slate-400 hover:text-ghanaYellow-500 text-xs mb-4"
      >
        ← Live scores
      </Link>

      {/* Identity */}
      <div className="flex items-center gap-4 mb-6">
        <Avatar src={team.logo_url} name={team.name} size={64} contain />
        <div className="min-w-0">
          <h1 className="font-display text-2xl md:text-4xl leading-tight truncate">
            {team.name}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {[team.city, team.region].filter(Boolean).join(", ") || "Ghana"}
            {homeVenue?.name && <span> · {homeVenue.name}</span>}
            {team.founded_year && <span> · Founded {team.founded_year}</span>}
          </p>
        </div>
      </div>

      {lines.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-xl mb-1">Sides</h2>
          <p className="text-[11px] text-slate-500 mb-3">
            The club fields more than one team. Every season counted together.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {lines.map((l) => (
              <div
                key={l.key}
                className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {l.label}
                    <span className="text-slate-500">
                      {" · "}
                      {divisionLabel(l.division) ?? l.division}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {l.played} played
                  </p>
                </div>
                <p className="font-display text-sm tabular-nums shrink-0">
                  <span className="text-emerald-400">{l.won}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-slate-400">{l.drawn}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-red-400">{l.lost}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-xl mb-3">Upcoming</h2>
          <div className="space-y-2">
            {upcoming.map((f) => (
              <MatchCard key={f.fixture_id} fixture={f} />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="mb-8">
          <h2 className="font-display text-xl mb-3">Recent results</h2>
          <div className="space-y-2">
            {recent.map((f) => (
              <MatchCard key={f.fixture_id} fixture={f} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl mb-3">
          Squad ({squadRows.length})
        </h2>
        {squadRows.length === 0 ? (
          <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
            No active squad listed yet.
          </p>
        ) : (
          squadGroups.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <h3 className="text-[11px] uppercase tracking-wider text-slate-500 mb-2 pb-1 border-b border-white/10">
                {group.label}
                <span className="text-slate-600"> · {group.players.length}</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {group.players.map((p: any) => (
                  <Link
                    key={p.player_id}
                    href={`/live/player/${p.player_id}`}
                    className="flex items-center gap-2.5 bg-neutral-900 border border-white/10 rounded-lg px-3 py-2.5 hover:border-white/25 transition min-w-0"
                  >
                    <Avatar
                      src={p.photo_url}
                      name={`${p.first_name ?? ""} ${p.last_name ?? ""}`}
                      size={36}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {p.first_name} {p.last_name}
                        {p.is_captain && (
                          <span className="ml-1 text-[10px] align-middle text-ghanaYellow-500">C</span>
                        )}
                      </span>
                      <span className="block text-[11px] text-slate-500 truncate">
                        {[p.jersey_number != null ? `#${p.jersey_number}` : null, p.position]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </>
  );
}
