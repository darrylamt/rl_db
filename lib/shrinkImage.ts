import sharp from "sharp";
import { MAX_IMAGE_SIDE, isShrinkableImage } from "@/lib/uploadLimits";

/**
 * Shrinks a picture on the server before it is stored: at most 1600px on
 * its longest side, saved as WebP. A phone photo goes from several MB to a
 * few hundred KB. Transparency is kept, so logos stay clean. Anything that
 * isn't a shrinkable picture (PDFs, GIFs, SVGs) is returned untouched.
 */
export async function shrinkImage(
  data: ArrayBuffer | Buffer,
  type: string,
  filename: string
): Promise<{ body: Buffer; type: string; filename: string }> {
  const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (!isShrinkableImage(type)) return { body: input, type, filename };
  try {
    const body = await sharp(input)
      .rotate() // respect the phone's orientation before it is stripped
      .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    // Keep the original if it was somehow already smaller.
    if (body.length >= input.length && /webp/i.test(type)) return { body: input, type, filename };
    return { body, type: "image/webp", filename: filename.replace(/\.[^.]*$/, "") + ".webp" };
  } catch {
    return { body: input, type, filename };
  }
}
