"use client";

/**
 * The club's colour, taken from its own crest.
 *
 * Nobody has entered a brand colour and asking clubs to would be another
 * field nobody fills, so it is read off the badge instead. Crests are drawn
 * on white or transparent grounds and outlined in black, so the near-white,
 * near-black and near-grey pixels are thrown away first — what is left is
 * the colour somebody would actually name if you asked them.
 *
 * Runs in the browser against Supabase storage, which serves the crests with
 * an open CORS header, so the canvas is readable rather than tainted. Results
 * are cached per URL for the life of the page.
 */

const cache = new Map<string, Promise<string | null>>();

export function dominantColour(url?: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const hit = cache.get(url);
  if (hit) return hit;
  const run = extract(url).catch(() => null);
  cache.set(url, run);
  return run;
}

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function extract(url: string): Promise<string | null> {
  const img = await load(url);
  const size = 48;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, size, size);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, size, size).data;
  } catch {
    // Tainted canvas — the crest came from somewhere without CORS.
    return null;
  }

  // Group near-identical pixels together, so anti-aliasing does not split one
  // colour across a hundred buckets and lose to a flat background.
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (data[i + 3] < 128) continue;

    const { s, l } = toHsl(r, g, b);
    if (l > 0.9 || l < 0.1) continue;
    // Below this is an anti-aliased blend between the badge and the paper it
    // sits on, not a colour anybody would name.
    if (s < 0.35) continue;

    const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
    const cur = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    cur.n += 1;
    cur.r += r;
    cur.g += g;
    cur.b += b;
    buckets.set(key, cur);
  }

  const found = Array.from(buckets.values());
  if (found.length === 0) return null;

  /**
   * Not simply the commonest colour: a vivid pixel says more about a badge
   * than a pale one covering more of it, and mid lightness beats something
   * nearly white or nearly black. Counting alone picked the soft edge tint
   * around a crest rather than the crest.
   */
  let best = found[0];
  let bestScore = -1;
  for (const v of found) {
    const r = Math.round(v.r / v.n);
    const g = Math.round(v.g / v.n);
    const b = Math.round(v.b / v.n);
    const { s, l } = toHsl(r, g, b);
    const score = v.n * s * s * Math.max(0.15, 1 - Math.abs(l - 0.5) * 1.4);
    if (score > bestScore) {
      bestScore = score;
      best = v;
    }
  }

  return readable(
    Math.round(best.r / best.n),
    Math.round(best.g / best.n),
    Math.round(best.b / best.n)
  );
}

function toHsl(r: number, g: number, b: number) {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return { h, s, l };
}

/**
 * The club's own hue, at a lightness that shows up on a dark card. A navy so
 * deep it disappears into the background is accurate and useless.
 */
function readable(r: number, g: number, b: number): string {
  const { h, s, l } = toHsl(r, g, b);
  const clampedL = Math.min(0.62, Math.max(0.46, l));
  const clampedS = Math.max(0.45, s);
  return `hsl(${Math.round(h * 360)} ${Math.round(clampedS * 100)}% ${Math.round(
    clampedL * 100
  )}%)`;
}
