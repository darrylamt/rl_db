import { createAdminClient } from "@/lib/supabase/server";
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
    prefix?: string;
  }>(req);
  if (!body) return fail("Invalid JSON body");

  const bucket = body.bucket ?? "";
  if (!ALLOWED_BUCKETS.has(bucket)) return fail("Unknown bucket");

  const ext = (body.filename?.split(".").pop() ?? "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const prefix = (body.prefix ?? "misc").replace(/[^a-z0-9/_-]/gi, "");
  const path = `${prefix}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) return fail(error.message, 500);

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

  return ok(
    { bucket, path: data.path, token: data.token, publicUrl: pub.publicUrl },
    { cache: "none" }
  );
}
