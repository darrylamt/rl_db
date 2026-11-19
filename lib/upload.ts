"use server";

import { r2Key, r2Put } from "@/lib/r2";
import { shrinkImage } from "@/lib/shrinkImage";
import { uploadTooBig } from "@/lib/uploadLimits";

export type UploadBucket =
  | "team-logos"
  | "player-photos"
  | "content-images"
  | "documents";

/** Uploads a file to R2 and returns its public URL. */
export async function uploadFile(
  file: File,
  bucket: UploadBucket,
  prefix: string
): Promise<string> {
  const tooBig = uploadTooBig(file.size, file.type);
  if (tooBig) throw new Error(tooBig);
  // Pictures are shrunk before they are stored; documents go as they are.
  const out = await shrinkImage(await file.arrayBuffer(), file.type || "application/octet-stream", file.name);
  return r2Put(r2Key(bucket, prefix, out.filename), out.body, out.type);
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
