import { createPublicClient } from "@/lib/supabase/server";
import { ok, fail, preflight } from "@/lib/api";
import { getOfficialRecord } from "@/lib/officiating";
import { readWithOptionalColumns } from "@/lib/optionalColumns";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

// GET /api/officials/:id
// One match official, and every match they were appointed to.
//
// Read from public_officials, the view that leaves phone, email, date of
// birth and age behind. The record is the same one the federation's own
// profile page shows, so the website and the live page cannot disagree about
// what somebody refereed.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createPublicClient();

  // level and level_gained arrive with supabase/official_levels.sql.
  const { data: official, error } = await readWithOptionalColumns<any>(
    "official_id, first_name, last_name, role, level, level_gained, region, nationality, photo_url, status",
    ["level", "level_gained"],
    (columns) =>
      supabase
        .from("public_officials")
        .select(columns)
        .eq("official_id", params.id)
        .maybeSingle()
  );

  if (error) return fail(error.message, 500);
  if (!official) return fail("Official not found", 404);

  const record = await getOfficialRecord(params.id);

  return ok({
    ...official,
    name: `${official.first_name ?? ""} ${official.last_name ?? ""}`.trim(),
    matches: record.matches,
    refereed: record.lines.filter((l) => l.role === "Referee").length,
    on_touch: record.lines.filter((l) => l.role === "Touch judge").length,
    games: record.lines,
  });
}
