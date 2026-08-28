"use server";

import { createAdminClient } from "@/lib/supabase/server";

export type UploadBucket =
  | "team-logos"
  | "player-photos"
  | "content-images"
  | "documents";

/** Uploads a file and returns its public URL. */
export async function uploadFile(
  file: File,
  bucket: UploadBucket,
  prefix: string
): Promise<string> {
  const supabase = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadImageFile(
  file: File,
  bucket: UploadBucket,
  prefix: string
): Promise<string> {
  return uploadFile(file, bucket, prefix);
}

/** Returns the new URL if a file was uploaded, otherwise the existing URL. */
export async function resolveImageUrl(
  fd: FormData,
  fieldName: string,
  bucket: UploadBucket,
  prefix: string,
  existingUrl: string | null | undefined
): Promise<string | null> {
  const file = fd.get(fieldName) as File | null;
  if (file && file.size > 0) {
    return uploadFile(file, bucket, prefix);
  }
  return existingUrl ?? null;
}

/**
 * For forms that offer both an upload and a URL box.
 *
 * An uploaded file wins. Otherwise the typed URL is used, which is what makes
 * it possible to clear a value or keep pointing at an external link — the
 * federation's existing documents live in Google Drive.
 */
export async function resolveUploadOrUrl(
  fd: FormData,
  fileField: string,
  urlValue: string | null,
  bucket: UploadBucket,
  prefix: string
): Promise<string | null> {
  const file = fd.get(fileField) as File | null;
  if (file && file.size > 0) {
    return uploadFile(file, bucket, prefix);
  }
  return urlValue ?? null;
}
