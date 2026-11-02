import { createAdminClient } from "@/lib/supabase/server";

export type PredictionCounts = { home: number; away: number };

/**
 * When a fixture kicks off, as milliseconds — the moment predictions shut.
 *
 * Ghana keeps GMT all year, so a date and time recorded against a fixture is
 * already UTC and needs no offset applied. A fixture with no time set closes
 * at the end of its day rather than the start of it, since "some time on
 * Saturday" should stay open on Saturday morning.
 */
export function kickoffAt(
  date: string | null | undefined,
  time: string | null | undefined
): number | null {
  if (!date) return null;
  // Times arrive as HH:MM or HH:MM:SS.
  const clock = time ? (time.length === 5 ? `${time}:00` : time.slice(0, 8)) : null;
  const stamp = clock ? `${date}T${clock}Z` : `${date}T23:59:59Z`;
  const ms = Date.parse(stamp);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Vote counts for one fixture. Reads via the service role, like the write
 * side — match_predictions has no anon policies, so a page using the public
 * client would just see nothing.
 *
 * Returns zeros rather than throwing when the migration hasn't run yet
 * (supabase/match_predictions.sql), the same tolerance the rest of the app
 * gives a column or table that is ahead of the database.
 */
export async function getPredictionCounts(
  fixtureId: string
): Promise<PredictionCounts> {
  return (await getPredictionCountsFor([fixtureId]))[fixtureId] ?? {
    home: 0,
    away: 0,
  };
}

/**
 * Counts for several fixtures in one query — the poll can be paged through
 * the next few matches, and one round trip per card would be a query per
 * fixture for a card only one of which is on screen.
 */
export async function getPredictionCountsFor(
  fixtureIds: string[]
): Promise<Record<string, PredictionCounts>> {
  const out: Record<string, PredictionCounts> = {};
  for (const id of fixtureIds) out[id] = { home: 0, away: 0 };
  if (fixtureIds.length === 0) return out;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("match_predictions")
    .select("fixture_id, choice")
    .in("fixture_id", fixtureIds);

  if (error || !data) return out;

  for (const row of data as any[]) {
    const bucket = out[row.fixture_id];
    if (!bucket) continue;
    if (row.choice === "home") bucket.home++;
    else if (row.choice === "away") bucket.away++;
  }
  return out;
}

/**
 * Casts (or changes) one browser's pick for a fixture. Shared by /live's
 * voting card and the public API the website votes through, so the two can
 * never disagree about when voting closes.
 *
 * device_id is a random id the browser made up for itself and keeps in
 * localStorage; there is no fan login, so it is the only "who" a vote has.
 * An upsert, so changing your mind moves the vote rather than adding one.
 */
export async function castVote(
  fixtureId: string,
  deviceId: string,
  choice: "home" | "away"
): Promise<void> {
  if (!fixtureId || !deviceId) throw new Error("Missing fixture or device id");
  if (choice !== "home" && choice !== "away") throw new Error("Invalid choice");
  if (deviceId.length > 64) throw new Error("Invalid device id");

  const supabase = createAdminClient();

  // A prediction made after kick-off is not a prediction. The cards hide the
  // buttons, but that is presentation; this is the part that decides.
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("scheduled_date, scheduled_time, status")
    .eq("fixture_id", fixtureId)
    .maybeSingle();

  if (!fixture) throw new Error("No such match");
  const f = fixture as any;
  if (f.status && !["scheduled", "postponed"].includes(f.status)) {
    throw new Error("That match has already started");
  }
  const closesAt = kickoffAt(f.scheduled_date, f.scheduled_time);
  if (closesAt && Date.now() >= closesAt) {
    throw new Error("Predictions closed at kick-off");
  }

  const { error } = await supabase
    .from("match_predictions")
    .upsert(
      { fixture_id: fixtureId, device_id: deviceId, choice },
      { onConflict: "fixture_id,device_id" }
    );

  // The table arrives with supabase/match_predictions.sql; until it is run a
  // vote simply does not stick, rather than breaking the page.
  if (error && !/relation .* does not exist/i.test(error.message)) {
    throw new Error(error.message);
  }
}
