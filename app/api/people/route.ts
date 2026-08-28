import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson } from "@/lib/api";
import { PERSON_GROUPS } from "@/lib/contentTypes";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/people            → both groups, keyed by group
// GET /api/people?group=board → just that group, as a flat list
//
// Board members and the management committee. Match officials live at
// /api/officials — this is federation governance, not referees.
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const group = url.searchParams.get("group");

  let query = supabase
    .from("people")
    .select("person_id, name, role, email, photo_url, group_name, sort_order")
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (group) query = query.eq("group_name", group);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);

  const items = data ?? [];
  if (group) return ok({ items, total: items.length });

  // Unfiltered: group them so the about page can render both sections
  // from one request.
  return ok({
    board: items.filter((p) => p.group_name === "board"),
    committee: items.filter((p) => p.group_name === "committee"),
    total: items.length,
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.name) return fail("`name` is required");
  if (body.group_name && !PERSON_GROUPS.includes(body.group_name)) {
    return fail(`\`group_name\` must be one of: ${PERSON_GROUPS.join(", ")}`);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("people")
    .insert({
      name: body.name,
      role: body.role ?? null,
      email: body.email ?? null,
      photo_url: body.photo_url ?? null,
      group_name: body.group_name ?? "board",
      sort_order: body.sort_order ?? 0,
      status: body.status ?? "active",
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
