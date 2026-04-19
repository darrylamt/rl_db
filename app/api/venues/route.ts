import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, requireAdmin, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("venues")
    .select("venue_id, name, region, city, capacity")
    .order("name");
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.name) return fail("`name` is required");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .insert({
      name: body.name,
      region: body.region ?? null,
      city: body.city ?? null,
      capacity: body.capacity ?? null,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
