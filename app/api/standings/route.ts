import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";
import { getLeagueTables } from "@/lib/leagueTable";

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

  // League phase only; playoffs come back separately (lib/leagueTable).
  let ids: string[] | undefined;
  if (competitionId) ids = [competitionId];
  else if (season) {
    const { data: comps, error } = await supabase
      .from("competitions")
      .select("competition_id")
      .eq("season", season);
    if (error) return fail(error.message, 500);
    ids = (comps ?? []).map((c: any) => c.competition_id as string);
    if (ids.length === 0) return ok({ items: [], playoffs: [], total: 0 });
  }

  const { rows, playoffs } = await getLeagueTables(supabase, ids);
  return ok({ items: rows, playoffs, total: rows.length }, { cache: "public" });
}
