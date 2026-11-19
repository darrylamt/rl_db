import { r2Put } from "@/lib/r2";
import { shrinkImage } from "@/lib/shrinkImage";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BUCKET = "article-images";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

// POST /api/articles/upload
// Accepts: multipart/form-data with a "file" field
// Returns: { url: string }
export async function POST(req: Request) {
  // Must be an authenticated admin
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return fail("Unauthorized", 401);

  // Parse multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail("Invalid form data", 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return fail("No file provided", 400);

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return fail(`Unsupported file type "${file.type}". Allowed: JPEG, PNG, WebP, GIF, AVIF.`, 400);
  }

  // Validate size
  if (file.size > MAX_BYTES) {
    return fail(`File too large (max ${MAX_BYTES / 1024 / 1024} MB)`, 400);
  }

  // Build a unique storage path
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const rand = Math.random().toString(36).slice(2, 10);
  const path = `${Date.now()}-${rand}.${ext}`;

  // Shrunk before storing: article photos were averaging nearly 1 MB each.
  const out = await shrinkImage(await file.arrayBuffer(), file.type || "image/jpeg", path);
  const publicUrl = await r2Put(`${BUCKET}/${out.filename}`, out.body, out.type);

  return NextResponse.json({ url: publicUrl });
}
