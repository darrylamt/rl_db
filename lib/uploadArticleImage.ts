import { shrinkImageInBrowser } from "@/lib/shrinkImageInBrowser";

/**
 * Uploads an article picture (the cover, or one inside the text) and
 * returns its address.
 *
 * Shrunk in the browser first: the upload passes through the server, and
 * Vercel refuses any request over 4.5 MB, so a full-size phone photo failed
 * with "Request Entity Too Large" — shown as a garbled JSON error, because
 * that reply isn't JSON. Shrunk, a photo is a few hundred KB.
 */
export async function uploadArticleImage(file: File): Promise<string> {
  const upload = await shrinkImageInBrowser(file);
  if (upload.size > 4 * 1024 * 1024) {
    throw new Error("That picture is too large even after shrinking. Try a smaller one (under 4 MB).");
  }
  const fd = new FormData();
  fd.append("file", upload);
  const res = await fetch("/api/articles/upload", { method: "POST", body: fd });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // Not JSON: a size limit or a server error page.
    throw new Error(
      res.status === 413 ? "That picture is too large to upload. Try a smaller one." : `Upload failed (${res.status}). Try again.`
    );
  }
  if (!res.ok || !json?.url) throw new Error(json?.error ?? "Upload failed");
  return json.url as string;
}
