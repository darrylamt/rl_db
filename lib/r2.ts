import { AwsClient } from "aws4fetch";

/**
 * Cloudflare R2: where every public picture and file now lives.
 *
 * Supabase Storage metered every download of a photo against the free plan,
 * and the photos alone used up the month's allowance and took the whole
 * project offline. R2 charges nothing for downloads.
 *
 * Files keep the layout they had in Supabase, `<bucket>/<path>`, so an old
 * Supabase address maps to an R2 one by swapping the start of the URL.
 * Private contract documents stay in Supabase: they are only ever opened
 * through short-lived signed links.
 */

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function client() {
  return new AwsClient({
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
}

function objectUrl(key: string): string {
  const account = env("R2_ACCOUNT_ID");
  const bucket = env("R2_BUCKET");
  const path = key.split("/").map(encodeURIComponent).join("/");
  return `https://${account}.r2.cloudflarestorage.com/${bucket}/${path}`;
}

/** The address anyone can open the file at. */
export function r2PublicUrl(key: string): string {
  return `${env("R2_PUBLIC_URL").replace(/\/$/, "")}/${key}`;
}

/** A storage key in the old Supabase layout: bucket, then a unique file name. */
export function r2Key(folder: string, prefix: string, filename: string): string {
  const ext = (filename.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const clean = prefix.replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "");
  const name = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  return [folder, clean, name].filter(Boolean).join("/");
}

/** Uploads from the server and returns the public address. */
export async function r2Put(
  key: string,
  body: ArrayBuffer | Uint8Array | Buffer,
  contentType = "application/octet-stream"
): Promise<string> {
  const res = await client().fetch(objectUrl(key), {
    method: "PUT",
    body: body as any,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  return r2PublicUrl(key);
}

/**
 * A link the browser can PUT one file to for the next ten minutes, so large
 * files never pass through Vercel's 4.5 MB request limit.
 */
export async function r2UploadUrl(key: string): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", "600");
  const signed = await client().sign(new Request(url, { method: "PUT" }), {
    aws: { signQuery: true },
  });
  return signed.url;
}
