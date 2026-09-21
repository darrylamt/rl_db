import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { readWithOptionalColumns } from "@/lib/optionalColumns";
import { effectiveGrade, gradeOfDivision, isYouth } from "@/lib/grades";
import { LineupPicker } from "./LineupPicker";
import { saveOfficials, saveCoaches, saveLineup } from "./actions";

export const dynamic = "force-dynamic";

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const ROLES = [
  { key: "referee", label: "Referee" },
  { key: "touch_judge_1", label: "Touch judge 1" },
  { key: "touch_judge_2", label: "Touch judge 2" },
] as const;

/**
 * Everything about a match that is not its score.
 *
 * A recorder filling in a season nobody wrote down needs the side, the
 * coaches and the officials, and until now none of it was reachable from
 * /enter: the club portal names a side before a game and the admin appoints
 * officials, and neither goes back three seasons.
 *
 * Saved one piece at a time rather than as one big form. A recorder working
 * off a paper team sheet does the home side, checks it, then the away — and
 * losing the lot to one bad field would be its own reason not to bother.
 */
export default async function MatchRecordPage({
  params,
  searchParams,
}: {
  params: { fixtureId: string };
  searchParams?: { error?: string; note?: string };
}) {
  const supabase = createAdminClient();
  const fixtureId = params.fixtureId;

  const { data: fixture } = await supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, status, home_team_id, away_team_id, home:home_team_id(team_id, name), away:away_team_id(team_id, name), competition:competition_id(name, season, division), result:match_results(home_score, away_score)"
    )
    .eq("fixture_id", fixtureId)
    .maybeSingle();

  if (!fixture) notFound();
  const f = fixture as any;
  const home = one<any>(f.home);
  const away = one<any>(f.away);
  const comp = one<any>(f.competition);
  const result = one<any>(f.result);

  // Which grade this competition is, so a men's match does not offer every
  // junior at the club.
  const grade = gradeOfDivision(comp?.division);

  const [
    { data: officials },
    { data: appointed },
    { data: coaches },
    { data: sheets },
    { data: squad },
    { data: lineups },
  ] = await Promise.all([
    supabase
      .from("officials")
      .select("official_id, first_name, last_name, role, status")
      .order("last_name"),
    supabase
      .from("fixture_officials")
      .select("role, official_id")
      .eq("fixture_id", fixtureId),
    supabase
      .from("coaches")
      .select("coach_id, first_name, last_name, role, team_id, status")
      .order("last_name"),
    supabase
      .from("team_sheets")
      .select("team_id, head_coach_id, assistant_coach_id")
      .eq("fixture_id", fixtureId),
    readWithOptionalColumns<any>(
      "player_id, first_name, last_name, position, jersey_number, team_id, category, gender",
      ["gender"],
      (columns) =>
        supabase
          .from("players")
          .select(columns)
          .in("team_id", [f.home_team_id, f.away_team_id].filter(Boolean))
          .eq("playing_status", "active")
          .order("last_name")
    ),
    supabase
      .from("match_lineups")
      .select("player_id, team_id, jersey_number, is_starter")
      .eq("fixture_id", fixtureId),
  ]);

  const appointedBy: Record<string, string> = {};
  for (const a of (appointed ?? []) as any[]) appointedBy[a.role] = a.official_id;

  const coachBy: Record<string, string> = {};
  for (const s of (sheets ?? []) as any[]) {
    const key = s.team_id === f.home_team_id ? "home" : "away";
    if (s.head_coach_id) coachBy[`${key}_head_coach_id`] = s.head_coach_id;
    if (s.assistant_coach_id) {
      coachBy[`${key}_assistant_coach_id`] = s.assistant_coach_id;
    }
  }

  // Retired officials stay pickable when they are already on this match —
  // taking them off the list would silently blank a game they did.
  const onThis = new Set(Object.values(appointedBy));
  const pickableOfficials = ((officials ?? []) as any[]).filter(
    (o) => o.status !== "inactive" || onThis.has(o.official_id)
  );

  const sides = [
    { key: "home" as const, team: home, teamId: f.home_team_id },
    { key: "away" as const, team: away, teamId: f.away_team_id },
  ];

  const squadFor = (teamId: string | null) =>
    ((squad ?? []) as any[]).filter((p) => {
      if (p.team_id !== teamId) return false;
      const g = effectiveGrade(p.category, p.gender);
      // A youth competition takes any youth player; a senior one takes the
      // matching senior grade.
      return isYouth(grade) ? isYouth(g) : g === grade;
    });

  const namedFor = (teamId: string | null) =>
    ((lineups ?? []) as any[]).filter((l) => l.team_id === teamId);

  return (
    <div>
      <Link href="/enter/archive" className="text-sm text-slate-400 hover:text-white">
        ← Back to past matches
      </Link>

      <header className="mt-3 mb-5">
        <h1 className="font-display text-xl leading-tight">
          {home?.name ?? "?"} <span className="text-slate-500">v</span>{" "}
          {away?.name ?? "?"}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {[f.scheduled_date, comp?.name, comp?.season].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm mt-2">
          {result && result.home_score != null ? (
            <span className="font-display text-lg tabular-nums">
              {result.home_score}&ndash;{result.away_score}
            </span>
          ) : (
            <span className="text-ghanaYellow-500">No result recorded</span>
          )}
          <Link
            href={`/enter/result?fixture=${fixtureId}`}
            className="text-slate-400 hover:text-white ml-3 text-xs"
          >
            {result ? "Edit the score →" : "Add the score →"}
          </Link>
        </p>
      </header>

      {searchParams?.error && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.error}
        </div>
      )}
      {searchParams?.note && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.note}
        </div>
      )}

      {/* ── Officials ── */}
      <section className="mb-6 bg-neutral-950 border border-white/10 rounded-lg p-4">
        <h2 className="font-display text-base mb-1">Match officials</h2>
        <p className="text-[11px] text-slate-500 mb-3">
          Anybody on the register can take any of the three. Leaving one blank
          takes that official off the match.
        </p>
        {pickableOfficials.length === 0 ? (
          <p className="text-sm text-slate-500">
            None on the register yet — the federation adds them.
          </p>
        ) : (
          <form action={saveOfficials.bind(null, fixtureId)} className="grid gap-3">
            {ROLES.map((r) => (
              <label key={r.key} className="text-xs text-slate-400">
                <span className="block mb-1">{r.label}</span>
                <select
                  name={r.key}
                  defaultValue={appointedBy[r.key] ?? ""}
                  className="w-full bg-neutral-950 border border-white/15 rounded px-2 py-2 text-sm text-white"
                >
                  <option value="">— none —</option>
                  {pickableOfficials.map((o: any) => (
                    <option key={o.official_id} value={o.official_id}>
                      {o.first_name} {o.last_name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button className="bg-ghanaYellow-500 text-black text-sm font-medium rounded px-3 py-2 hover:bg-ghanaYellow-400">
              Save officials
            </button>
          </form>
        )}
      </section>

      {/* ── Coaches ── */}
      <section className="mb-6 bg-neutral-950 border border-white/10 rounded-lg p-4">
        <h2 className="font-display text-base mb-1">Coaches</h2>
        <p className="text-[11px] text-slate-500 mb-3">
          Each side is offered the coaches that club may name, plus anybody
          the federation left open to everyone.
        </p>
        {((coaches ?? []) as any[]).length === 0 ? (
          <p className="text-sm text-slate-500">
            None on the register yet — the federation adds them.
          </p>
        ) : (
          <form action={saveCoaches.bind(null, fixtureId)} className="grid gap-4">
            {sides.map((side) => {
              const options = ((coaches ?? []) as any[]).filter(
                (c) =>
                  c.status === "active" &&
                  (!c.team_id || c.team_id === side.teamId)
              );
              return (
                <div key={side.key} className="border border-white/10 rounded p-3">
                  <p className="text-sm font-medium mb-2">{side.team?.name}</p>
                  {options.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No coaches registered to this club.
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        { n: "head_coach_id", l: "Head coach" },
                        { n: "assistant_coach_id", l: "Assistant" },
                      ].map((slot) => (
                        <label key={slot.n} className="text-xs text-slate-400">
                          <span className="block mb-1">{slot.l}</span>
                          <select
                            name={`${side.key}_${slot.n}`}
                            defaultValue={coachBy[`${side.key}_${slot.n}`] ?? ""}
                            className="w-full bg-neutral-950 border border-white/15 rounded px-2 py-2 text-sm text-white"
                          >
                            <option value="">— none —</option>
                            {options.map((c: any) => (
                              <option key={c.coach_id} value={c.coach_id}>
                                {c.first_name} {c.last_name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button className="bg-ghanaYellow-500 text-black text-sm font-medium rounded px-3 py-2 hover:bg-ghanaYellow-400">
              Save coaches
            </button>
          </form>
        )}
      </section>

      {/* ── Team sheets, one club at a time ── */}
      {sides.map((side) => {
        const squadHere = squadFor(side.teamId);
        const namedHere = namedFor(side.teamId);
        return (
          <section
            key={side.key}
            className="mb-6 bg-neutral-950 border border-white/10 rounded-lg p-4"
          >
            <h2 className="font-display text-base mb-1">
              {side.team?.name ?? side.key} team sheet
            </h2>
            <p className="text-[11px] text-slate-500 mb-3">
              {namedHere.length > 0
                ? `${namedHere.length} named. Saving replaces the side, so anyone unticked comes off.`
                : "Nobody named yet. Tick who played, set shirt numbers, mark the bench."}
            </p>
            <form action={saveLineup.bind(null, fixtureId, side.teamId)}>
              <LineupPicker squad={squadHere} named={namedHere} />
              <button className="mt-3 w-full bg-ghanaYellow-500 text-black text-sm font-medium rounded px-3 py-2 hover:bg-ghanaYellow-400">
                Save {side.team?.name ?? "side"}
              </button>
            </form>
          </section>
        );
      })}
    </div>
  );
}
