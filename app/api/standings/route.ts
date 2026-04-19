import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/standings
// GET /api/standings?competition=<uuid>
export async function GET(req: Request) {
  const supabase = createClient();
  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competition");

  let q = supabase
    .from("standings")
    .select("*")
    .order("league_points", { ascending: false });

  if (competitionId) q = q.eq("competition_id", competitionId);

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}
