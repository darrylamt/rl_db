import { r2Key, r2PublicUrl, r2UploadUrl } from "@/lib/r2";
import { uploadTooBig } from "@/lib/uploadLimits";
import { ok, fail, requireAdmin, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

// Buckets an admin may request an upload slot for. Anything else is rejected
// so this can't be used to write into arbitrary storage.
const ALLOWED_BUCKETS = new Set([
  "content-images",
  "documents",
  "team-logos",
  "player-photos",
]);

/**
 * POST /api/admin/upload-url
 * Body: { bucket, filename, prefix }
 *
 * Returns a one-shot signed upload slot so the browser can send the file
 * straight to Supabase Storage. Going through a server action instead would
 * cap uploads at Next's 1 MB body limit — and Vercel's 4.5 MB — which is far
 * too small for an annual report.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson<{
    bucket?: string;
    filename?: string;
    size?: number;
    type?: string;
    prefix?: string;
  }>(req);
  if (!body) return fail("Invalid JSON body");

  const bucket = body.bucket ?? "";
  if (!ALLOWED_BUCKETS.has(bucket)) return fail("Unknown bucket");

  // Straight to R2 with a ten-minute signed link; the public address is
  // what gets saved.
  const tooBig = uploadTooBig(Number(body?.size ?? 0), body?.type);
  if (tooBig) return fail(tooBig, 413);
  const key = r2Key(bucket, body.prefix ?? "misc", body.filename ?? "file.bin");
  return ok(
    { uploadUrl: await r2UploadUrl(key), publicUrl: r2PublicUrl(key) },
    { cache: "none" }
  );
}
