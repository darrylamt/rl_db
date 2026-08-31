import { createAdminClient } from "@/lib/supabase/server";
import { award, getRules } from "@/lib/credits";
import { normaliseType } from "@/lib/matchStats";

export type SweepResult = {
  season: string;
  added: number;
  alreadyThere: number;
  flagged: { team: string; label: string; amount: number; why: string }[];
  errors: string[];
};

/**
 * Works out every credit the system can settle by itself for one season.
 *
 * Safe to run as often as anybody likes: each entry carries a dedupe key, so
 * a second run adds only what has happened since. That matters because this
 * is meant to be run casually — after a match day, or when somebody wonders
 * whether the table is up to date — not as a careful annual ceremony.
 *
 * Anything the regulations mark as needing review is not written. A red
 * card, a walkover, an abandonment: the sweep reports them for the
 * federation to decide on, which is the concept note's own rule.
 */
export async function runCreditSweep(
  season: string,
  actorId?: string | null
): Promise<SweepResult> {
  const supabase = createAdminClient();
  const result: SweepResult = {
    season,
    added: 0,
    alreadyThere: 0,
    flagged: [],
    errors: [],
  };

  const rules = await getRules();
  const rule = (code: string) => rules.find((r) => r.code === code);

  const give = async (
    code: string,
    teamId: string,
    teamName: string,
    dedupeKey: string,
    description: string,
    fixtureId?: string | null
  ) => {
    const r = rule(code);
    if (!r || !r.active) return;

    // The federation looks at these before anything is taken away.
    if (r.requires_review) {
      result.flagged.push({
        team: teamName,
        label: r.label,
        amount: r.amount,
        why: description,
      });
      return;
    }

    const res = await award({
      teamId,
      season,
      code,
      amount: r.amount,
      description,
      fixtureId,
      awardedBy: actorId ?? null,
      automatic: true,
      dedupeKey,
    });

    if (!res.ok) result.errors.push(`${teamName} · ${r.label}: ${res.error}`);
    else if (res.duplicate) result.alreadyThere += 1;
    else result.added += 1;
  };

  // ── The season's matches ──────────────────────────────────
  const { data: comps } = await supabase
    .from("competitions")
    .select("competition_id, name")
    .eq("season", season);
  const compIds = ((comps ?? []) as any[]).map((c) => c.competition_id);
  if (compIds.length === 0) return result;

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, status, round, home_team_id, away_team_id, forfeited_by_team_id, home:home_team_id(name), away:away_team_id(name), result:match_results(home_score, away_score)"
    )
    .in("competition_id", compIds)
    .order("scheduled_date");

  const played = ((fixtures ?? []) as any[]).filter((f) =>
    ["completed", "abandoned"].includes(f.status)
  );

  const { data: events } = await supabase
    .from("match_events")
    .select("fixture_id, team_id, event_type, player:player_id(team_id)")
    .in(
      "fixture_id",
      played.map((f) => f.fixture_id)
    );

  const { data: sheets } = await supabase
    .from("team_sheets")
    .select("fixture_id, team_id, status, submitted_at");

  const sheetFor = new Map(
    ((sheets ?? []) as any[]).map((s) => [`${s.fixture_id}:${s.team_id}`, s])
  );

  for (const f of played) {
    const sides = [
      { id: f.home_team_id, name: f.home?.name ?? "Home", home: true },
      { id: f.away_team_id, name: f.away?.name ?? "Away", home: false },
    ].filter((s) => s.id);

    const r = Array.isArray(f.result) ? f.result[0] : f.result;
    const mine = ((events ?? []) as any[]).filter(
      (e) => e.fixture_id === f.fixture_id
    );

    for (const side of sides) {
      const abandoned = f.status === "abandoned";
      const forfeited = f.forfeited_by_team_id === side.id;

      if (abandoned) {
        await give(
          "match_abandoned",
          side.id,
          side.name,
          `match_abandoned:${f.fixture_id}`,
          `${f.home?.name} v ${f.away?.name} on ${f.scheduled_date} was abandoned`,
          f.fixture_id
        );
        continue;
      }

      if (forfeited) {
        await give(
          "walkover",
          side.id,
          side.name,
          `walkover:${f.fixture_id}`,
          `Did not turn up for ${f.home?.name} v ${f.away?.name} on ${f.scheduled_date}`,
          f.fixture_id
        );
        continue;
      }

      // Turning up is the credit — including when the other side did not.
      await give(
        "fixture_fulfilled",
        side.id,
        side.name,
        `fixture_fulfilled:${f.fixture_id}`,
        `Fulfilled ${f.home?.name} v ${f.away?.name} on ${f.scheduled_date}`,
        f.fixture_id
      );

      if (r) {
        const ours = side.home ? r.home_score ?? 0 : r.away_score ?? 0;
        const theirs = side.home ? r.away_score ?? 0 : r.home_score ?? 0;
        if (ours > theirs) {
          await give(
            "match_won",
            side.id,
            side.name,
            `match_won:${f.fixture_id}`,
            `Beat ${side.home ? f.away?.name : f.home?.name} ${ours}-${theirs}`,
            f.fixture_id
          );
        }
      }

      // ── Discipline ────────────────────────────────────────
      const sideOf = (e: any) =>
        e.team_id ??
        (Array.isArray(e.player) ? e.player[0] : e.player)?.team_id ??
        null;
      const ourEvents = mine.filter((e) => sideOf(e) === side.id);
      const yellows = ourEvents.filter(
        (e) => ["yellow_card", "sin_bin"].includes(normaliseType(e.event_type))
      ).length;
      const reds = ourEvents.filter(
        (e) => normaliseType(e.event_type) === "red_card"
      ).length;

      for (let i = 0; i < yellows; i++) {
        await give(
          "yellow_card",
          side.id,
          side.name,
          `yellow_card:${f.fixture_id}:${i}`,
          `Yellow card in ${f.home?.name} v ${f.away?.name}`,
          f.fixture_id
        );
      }
      for (let i = 0; i < reds; i++) {
        await give(
          "red_card",
          side.id,
          side.name,
          `red_card:${f.fixture_id}:${i}`,
          `Red card in ${f.home?.name} v ${f.away?.name}`,
          f.fixture_id
        );
      }
      if (yellows === 0 && reds === 0) {
        await give(
          "clean_discipline_match",
          side.id,
          side.name,
          `clean_discipline:${f.fixture_id}`,
          `No cards against ${side.home ? f.away?.name : f.home?.name}`,
          f.fixture_id
        );
      }

      // ── The team sheet ────────────────────────────────────
      // On time means approved or with the federation before kick-off day.
      const sheet = sheetFor.get(`${f.fixture_id}:${side.id}`);
      if (!sheet) {
        await give(
          "team_sheet_missing",
          side.id,
          side.name,
          `team_sheet_missing:${f.fixture_id}`,
          `No team sheet for ${f.home?.name} v ${f.away?.name}`,
          f.fixture_id
        );
      } else {
        const on = sheet.submitted_at
          ? String(sheet.submitted_at).slice(0, 10) < (f.scheduled_date ?? "")
          : false;
        await give(
          on ? "team_sheet_on_time" : "team_sheet_late",
          side.id,
          side.name,
          `team_sheet:${f.fixture_id}`,
          on
            ? `Team sheet in before ${f.scheduled_date}`
            : `Team sheet not in until match day for ${f.home?.name} v ${f.away?.name}`,
          f.fixture_id
        );
      }

      // ── Match operations ──────────────────────────────────
      // Awarded by default. A failure is a deduction somebody reports; an
      // official running the clock cannot tick two boxes per club per match.
      await give(
        "equipment_setup",
        side.id,
        side.name,
        `equipment_setup:${f.fixture_id}`,
        `Equipment set up for ${f.scheduled_date}`,
        f.fixture_id
      );
      await give(
        "equipment_teardown",
        side.id,
        side.name,
        `equipment_teardown:${f.fixture_id}`,
        `Equipment stored after ${f.scheduled_date}`,
        f.fixture_id
      );
    }
  }

  // ── Squad size ────────────────────────────────────────────
  const { data: teams } = await supabase
    .from("teams")
    .select("team_id, name")
    .eq("team_type", "club")
    .neq("is_public", false);

  for (const t of (teams ?? []) as any[]) {
    const { count } = await supabase
      .from("players")
      .select("player_id", { count: "exact", head: true })
      .eq("team_id", t.team_id)
      .eq("playing_status", "active");

    if ((count ?? 0) >= 20) {
      await give(
        "min_20_players",
        t.team_id,
        t.name,
        `min_20_players:${season}`,
        `${count} registered players`,
        null
      );
    }
  }

  return result;
}
