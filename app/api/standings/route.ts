import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/standings
// GET /api/standings?competition=<uuid>
// GET /api/standings?season=2025  (returns standings for all comps in that season)
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const competitionId = url.searchParams.get("competition");
  const season = url.searchParams.get("season");

  let q = supabase
    .from("standings")
    .select("*")
    .order("league_points", { ascending: false })
    .order("goal_difference", { ascending: false });

  if (competitionId) q = q.eq("competition_id", competitionId);

  if (season && !competitionId) {
    const { data: comps } = await supabase
      .from("competitions")
      .select("competition_id")
      .eq("season", season);
    const ids = (comps ?? []).map((c: any) => c.competition_id as string);
    if (ids.length === 0) return ok({ items: [], total: 0 });
    q = q.in("competition_id", ids);
  }

  const { data, error } = await q;
  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [], total: data?.length ?? 0 }, { cache: "short" });
}
