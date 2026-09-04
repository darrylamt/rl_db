import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { MatchCard } from "@/app/live/MatchCard";
import { FIXTURE_SELECT } from "@/lib/matchStats";

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
      supabase
        .from("public_players")
        .select("player_id, first_name, last_name, jersey_number, position, is_captain, photo_url")
        .eq("team_id", teamId)
        .eq("playing_status", "active")
        .order("jersey_number", { ascending: true, nullsFirst: false }),
      supabase
        .from("fixtures")
        .select(`${FIXTURE_SELECT}, result:match_results(home_score, away_score)`)
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("scheduled_date", { ascending: false })
        .limit(60),
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
          Squad ({(squad ?? []).length})
        </h2>
        {(squad ?? []).length === 0 ? (
          <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-8 text-center text-slate-500 text-sm">
            No active squad listed yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {(squad ?? []).map((p: any) => (
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
        )}
      </section>
    </>
  );
}
