"use server";

import { createAdminClient } from "@/lib/supabase/server";

export type UploadBucket = "team-logos" | "player-photos";

export async function uploadImageFile(
  file: File,
  bucket: UploadBucket,
  prefix: string
): Promise<string> {
  const supabase = createAdminClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: file.type || "image/jpeg", upsert: false });

  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
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
    return uploadImageFile(file, bucket, prefix);
  }
  return existingUrl ?? null;
}
