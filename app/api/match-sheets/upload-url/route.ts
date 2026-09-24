import { createAdminClient } from "@/lib/supabase/server";
import { ok, fail, readJson } from "@/lib/api";
import { getAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const BUCKET = "match-sheets";

/**
 * POST /api/match-sheets/upload-url
 * Body: { fixtureId, filename }
 *
 * A one-shot signed slot for a photo or scan of a match sheet, so the file
 * goes straight from the phone to storage. A phone photo is several
 * megabytes, more than a server action can carry (1 MB, 4.5 MB on Vercel).
 *
 * Separate from /api/admin/upload-url because recorders use it too, and it
 * writes into this one bucket only.
 */
export async function POST(req: Request) {
  const user = await getAppUser();
  if (!user || !user.provisioned || user.onHold) return fail("Unauthorized", 401);
  if (user.role !== "recorder" && user.role !== "federation") {
    return fail("Match sheets are for recorders and the federation", 403);
  }

  const body = await readJson<{ fixtureId?: string; filename?: string }>(req);
  const fixtureId = (body?.fixtureId ?? "").replace(/[^a-f0-9-]/gi, "");
  if (!fixtureId) return fail("Which match?");

  const ext = (body?.filename?.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${fixtureId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) {
    const missing = /not found/i.test(error.message);
    return fail(
      missing ? "Match sheets aren't set up yet — run supabase/match_sheets.sql." : error.message,
      500
    );
  }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return ok(
    { bucket: BUCKET, path: data.path, token: data.token, publicUrl: pub.publicUrl },
    { cache: "none" }
  );
}
