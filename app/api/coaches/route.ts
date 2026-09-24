import { createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, parsePagination } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

/** What may leave the building. Phone and email stay on the register. */
const PUBLIC_COLUMNS =
  "coach_id, first_name, last_name, role, qualification, region, nationality, photo_url, status, team:team_id(team_id, name, slug)";

// GET /api/coaches
// GET /api/coaches?team=<team_id>
// GET /api/coaches?status=active
//
// Named columns rather than "*": the coaches table holds phone numbers and
// email addresses, and a public list must not carry them.
export async function GET(req: Request) {
  const supabase = createAdminClient();
  const url = new URL(req.url);
  const team = url.searchParams.get("team");
  const status = url.searchParams.get("status");
  const { from, to } = parsePagination(url);

  let q = supabase
    .from("coaches")
    .select(PUBLIC_COLUMNS, { count: "exact" })
    .order("last_name")
    .range(from, to);

  if (team) q = q.eq("team_id", team);
  if (status) q = q.eq("status", status);

  const { data, error, count } = await q;
  if (error) {
    // Before supabase/coaches.sql the table does not exist: an empty list,
    // not an error, so a page asking for a club's coach still renders.
    if ((error as any).code === "42P01" || (error as any).code === "PGRST205") {
      return ok({ items: [], total: 0 });
    }
    return fail(error.message, 500);
  }

  const items = (data ?? []).map((c: any) => ({
    ...c,
    name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    team: Array.isArray(c.team) ? c.team[0] ?? null : c.team ?? null,
  }));
  return ok({ items, total: count ?? 0 });
}
