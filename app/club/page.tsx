import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { requireClub } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Whether a match has actually been played.
 *
 * The date alone is not the answer: a match kicking off at two o'clock is
 * still today's date at six, so splitting on the date left a finished match
 * sitting under "coming up" with no score against it. A result, or a fixture
 * marked completed, is what settles it.
 */
function isPlayed(f: any): boolean {
  const r = Array.isArray(f?.result) ? f.result[0] : f?.result;
  if (r && ((r.home_score ?? 0) > 0 || (r.away_score ?? 0) > 0)) return true;
  return ["completed", "abandoned", "cancelled"].includes(f?.status ?? "");
}

export default async function ClubOverviewPage() {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();

  const [{ data: team }, { data: players }, { data: registrations }, { data: fixtures }, { data: partners }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("name, division, region, city, founded_year, coach_name, manager_name, home_venue:home_venue_id(name)")
        .eq("team_id", teamId)
        .maybeSingle(),
      supabase
        .from("players")
        .select("player_id, position, photo_url, date_of_birth")
        .eq("team_id", teamId),
      supabase
        .from("player_registrations")
        .select("player_id")
        .eq("team_id", teamId)
        .eq("season_year", CURRENT_YEAR),
      supabase
        .from("fixtures")
        .select("fixture_id, scheduled_date, status, home:home_team_id(name), away:away_team_id(name), competition:competition_id(name, season), result:match_results(home_score, away_score)")
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .order("scheduled_date", { ascending: true })
        .limit(200),
      // Fails harmlessly until club_partners.sql has been run.
      supabase
        .from("partners")
        .select("partner_id, name, logo_url, link, designation")
        .eq("team_id", teamId)
        .eq("status", "active")
        .order("sort_order"),
    ]);

  const squad = players ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const all = (fixtures ?? []) as any[];
  const upcoming = all
    .filter((f: any) => !isPlayed(f) && (f.scheduled_date ?? "") >= today)
    .slice(0, 3);
  // A match played today belongs under a result, not under a kick-off time.
  const justPlayed = all
    .filter((f: any) => isPlayed(f) && (f.scheduled_date ?? "") <= today)
    .slice(-3)
    .reverse();

  const missingPosition = squad.filter((p: any) => !p.position).length;
  const missingPhoto = squad.filter((p: any) => !p.photo_url).length;
  const missingDob = squad.filter((p: any) => !p.date_of_birth).length;

  const jobs = [
    { n: missingPosition, label: "without a position", href: "/club/players?only=no-position" },
    { n: missingPhoto, label: "without a photo", href: "/club/players?only=no-photo" },
    { n: missingDob, label: "without a date of birth", href: "/club/players" },
  ].filter((j) => j.n > 0);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">{team?.name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {[team?.division, team?.city, team?.region].filter(Boolean).join(" · ") || "Club"}
        </p>
      </div>

      {/* The work, first — this portal exists so squads get filled in. */}
      {jobs.length > 0 ? (
        <section className="bg-white border border-slate-200 rounded-lg p-4">
          <h2 className="font-display text-lg text-navy-900 mb-1">Needs your attention</h2>
          <p className="text-xs text-slate-500 mb-3">
            The federation uses these to build squad lists, match programmes and
            player profiles.
          </p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {jobs.map((j) => (
              <li key={j.label}>
                <Link
                  href={j.href}
                  className="block border border-amber-200 bg-amber-50 hover:border-amber-400 rounded p-3"
                >
                  <span className="block font-display text-2xl text-amber-900">{j.n}</span>
                  <span className="block text-xs text-amber-800">{j.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm text-emerald-900">
          Every player has a position, a photo and a date of birth. Nothing
          outstanding.
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Players on record", value: squad.length },
          { label: `Registered for ${CURRENT_YEAR}`, value: (registrations ?? []).length },
          { label: "Matches on record", value: (fixtures ?? []).length },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{s.label}</p>
            <p className="font-display text-3xl font-bold text-navy-900">{s.value}</p>
          </div>
        ))}
      </section>

      {justPlayed.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-navy-900 mb-2">Latest results</h2>
          <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {justPlayed.map((f: any) => {
              const r = Array.isArray(f.result) ? f.result[0] : f.result;
              return (
                <li key={f.fixture_id} className="px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-3">
                  <span className="text-slate-500 w-24 shrink-0">{f.scheduled_date}</span>
                  <span className="font-medium text-navy-900 flex-1 min-w-0">
                    {f.home?.name} <span className="text-slate-400">v</span> {f.away?.name}
                  </span>
                  {r && (
                    <span className="font-display tabular-nums text-navy-900 shrink-0">
                      {r.home_score}–{r.away_score}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-navy-900 mb-2">Coming up</h2>
          <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {upcoming.map((f: any) => (
              <li key={f.fixture_id} className="px-4 py-2.5 text-sm flex flex-wrap gap-x-3">
                <span className="text-slate-500 w-24 shrink-0">{f.scheduled_date}</span>
                <span className="font-medium text-navy-900">
                  {f.home?.name} v {f.away?.name}
                </span>
                {f.competition?.name && (
                  <span className="text-xs text-slate-400">{f.competition.name}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(partners ?? []).length > 0 && (
        <section>
          <h2 className="font-display text-lg text-navy-900 mb-2">Your partners</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(partners ?? []).map((s: any) => (
              <li key={s.partner_id} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5 flex items-center gap-3">
                {s.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <Avatar src={s.logo_url} name={s.name} size={40} rounded="md" contain />
                ) : (
                  <Avatar src={null} name={s.name} size={40} rounded="md" />
                )}
                <span className="min-w-0">
                  <span className="block font-medium text-navy-900 truncate">{s.name}</span>
                  {s.designation && (
                    <span className="block text-xs text-slate-500 truncate">{s.designation}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-2">
            Held by the federation — ask them to add or change a partner.
          </p>
        </section>
      )}

      {/* Read-only club detail: yours to see, the federation's to change. */}
      <section>
        <h2 className="font-display text-lg text-navy-900 mb-2">Club details</h2>
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 text-sm">
          {[
            ["Division", team?.division],
            ["Home ground", (team?.home_venue as any)?.name],
            ["City", team?.city],
            ["Region", team?.region],
            ["Founded", team?.founded_year],
            ["Coach", team?.coach_name],
            ["Manager", team?.manager_name],
          ].map(([label, value]) => (
            <div key={String(label)} className="flex justify-between gap-4 px-4 py-2.5">
              <span className="text-slate-500">{label}</span>
              <span className="font-medium text-navy-900 text-right">
                {value ? String(value) : "—"}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Something wrong here? These are held by the federation — ask them to
          correct it.
        </p>
      </section>
    </div>
  );
}
