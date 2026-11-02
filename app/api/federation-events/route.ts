import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

const COLUMNS =
  "event_id, title, category, starts_on, start_time, ends_on, venue, summary, details, image_url, link, status";

/**
 * GET /api/federation-events                 every published event
 * GET /api/federation-events?when=upcoming    from today on, soonest first
 * GET /api/federation-events?when=past        before today, newest first
 * GET /api/federation-events?id=<uuid>        one event
 * GET /api/federation-events?limit=3
 *
 * RLFG events (tournaments, clinics, AGMs...), as entered under Public site >
 * Events. Drafts never leave the admin: the table's policy hides them from
 * this public reader. An event running over several days counts as upcoming
 * until its last day.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const when = url.searchParams.get("when");
  const id = url.searchParams.get("id");
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") ?? "100", 10) || 100, 1), 200);
  const today = new Date().toISOString().slice(0, 10);

  const supabase = createPublicClient();
  let q = supabase.from("federation_events").select(COLUMNS);

  if (id) {
    const { data, error } = await q.eq("event_id", id).maybeSingle();
    if (error && (error.code === "42P01" || error.code === "PGRST205")) return fail("Event not found", 404);
    if (error) return fail(error.message, 500);
    if (!data) return fail("Event not found", 404);
    return ok(data);
  }

  if (when === "upcoming") {
    // Still on, or still to come: ends today or later.
    q = q.or(`ends_on.gte.${today},and(ends_on.is.null,starts_on.gte.${today})`).order("starts_on", { ascending: true });
  } else if (when === "past") {
    q = q.or(`ends_on.lt.${today},and(ends_on.is.null,starts_on.lt.${today})`).order("starts_on", { ascending: false });
  } else {
    q = q.order("starts_on", { ascending: true });
  }

  const { data, error } = await q.limit(limit);
  // Before supabase/federation_events.sql has run: no events, not an error.
  if (error && (error.code === "42P01" || error.code === "PGRST205")) return ok({ items: [] });
  if (error) return fail(error.message, 500);
  return ok({ items: data ?? [] });
}
