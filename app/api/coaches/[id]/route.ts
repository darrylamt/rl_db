import { createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";
import { getCoachRecord } from "@/lib/officiating";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/coaches/:id
// One coach, and every match they took charge of with how it went.
//
// Named columns only — see /api/coaches. The record covers matches with a
// team sheet naming them, which is not every match they coached; the
// response says so, so a page cannot present a third of a career as all of it.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();
  const { data: coach, error } = await supabase
    .from("coaches")
    .select(
      "coach_id, first_name, last_name, role, qualification, region, nationality, photo_url, status, team:team_id(team_id, name, slug)"
    )
    .eq("coach_id", params.id)
    .maybeSingle();

  if (error) return fail(error.message, 500);
  if (!coach) return fail("Coach not found", 404);

  const record = await getCoachRecord(params.id);
  const c: any = coach;

  return ok({
    ...c,
    name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    team: Array.isArray(c.team) ? c.team[0] ?? null : c.team ?? null,
    played: record.decided,
    won: record.won,
    drawn: record.drawn,
    lost: record.lost,
    win_rate: record.decided > 0 ? Math.round((record.won / record.decided) * 100) : null,
    games: record.lines,
    note: "Covers matches with a team sheet naming this coach, which is not every match on record.",
  });
}
