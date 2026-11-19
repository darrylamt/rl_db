import { r2Key, r2PublicUrl, r2UploadUrl } from "@/lib/r2";
import { uploadTooBig } from "@/lib/uploadLimits";
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

  const body = await readJson<{ fixtureId?: string; filename?: string; size?: number; type?: string }>(req);
  const fixtureId = (body?.fixtureId ?? "").replace(/[^a-f0-9-]/gi, "");
  if (!fixtureId) return fail("Which match?");

  const tooBig = uploadTooBig(Number(body?.size ?? 0), body?.type);
  if (tooBig) return fail(tooBig, 413);
  const key = r2Key(BUCKET, fixtureId, body?.filename ?? "sheet.jpg");
  return ok(
    { uploadUrl: await r2UploadUrl(key), publicUrl: r2PublicUrl(key) },
    { cache: "none" }
  );
}
