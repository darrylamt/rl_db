import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * The General Manager's signature, printed on the back of every ID card and
 * in the federation's box on transfer sheets.
 *
 * Uploaded once in Admin → ID Cards → Signature, as a photo or scan of the
 * signature on white paper. The paper is taken out so only the ink is left,
 * which then prints cleanly on any background.
 */

export type Signatory = { url: string; name: string; title: string };

const KEY = "gm_signature";

export async function getSignatory(): Promise<Signatory | null> {
  const { data } = await createAdminClient().from("federation_settings").select("value").eq("key", KEY).maybeSingle();
  const v = (data?.value ?? null) as Signatory | null;
  return v?.url ? v : null;
}

export async function saveSignatory(value: Signatory) {
  const { error } = await createAdminClient()
    .from("federation_settings")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** The signature as a PNG data URI for the card and sheet renderers, or null. */
export async function signatureImage(s: Signatory | null): Promise<string | null> {
  if (!s?.url) return null;
  try {
    const res = await fetch(s.url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return `data:image/png;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * A photo of a signature on paper → the ink alone, on transparent.
 *
 * Light pixels (the paper) become fully transparent, dark ones (the ink)
 * opaque, with a soft edge between so the strokes stay smooth. The ink is
 * redrawn in one dark navy, so a blue or black pen prints the same, and the
 * result is cropped to the signature.
 */
export async function cleanSignature(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 1400, withoutEnlargement: true })
    .greyscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const px = info.width * info.height;
  const out = Buffer.alloc(px * 4);
  for (let i = 0; i < px; i++) {
    const l = data[i * info.channels];
    // Paper at 190 and up is gone; darker than that fades in to full ink.
    const alpha = l >= 190 ? 0 : Math.min(255, Math.round((190 - l) * 2.2));
    out[i * 4] = 11;
    out[i * 4 + 1] = 21;
    out[i * 4 + 2] = 38;
    out[i * 4 + 3] = alpha;
  }

  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .resize({ height: 220, withoutEnlargement: true })
    .png()
    .toBuffer();
}
