import { MAX_IMAGE_SIDE, isShrinkableImage } from "@/lib/uploadLimits";

/**
 * Shrinks a picture in the browser before it is uploaded straight to R2:
 * at most 1600px on its longest side, as WebP (JPEG where the browser
 * can't write WebP). Saves the upload time on a phone as well as the
 * storage. Anything else, or anything that fails, goes up unchanged.
 */
export async function shrinkImageInBrowser(file: File): Promise<File> {
  if (!isShrinkableImage(file.type) || file.size < 200 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
    // Safari can't write WebP and hands back a PNG instead; JPEG is smaller.
    const out =
      blob && blob.type === "image/webp"
        ? blob
        : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!out || out.size >= file.size) return file;
    const ext = out.type === "image/webp" ? "webp" : "jpg";
    return new File([out], file.name.replace(/\.[^.]*$/, "") + "." + ext, { type: out.type });
  } catch {
    return file;
  }
}
