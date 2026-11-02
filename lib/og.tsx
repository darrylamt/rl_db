import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Link-preview images: the card WhatsApp, Snapchat, X and the rest show when
 * someone shares a page of rlghana.com. 1200 by 630, the size they all
 * expect. Drawn from the live record, so a shared player shows his numbers as
 * they are today.
 *
 * In rl_db rather than on the website because this is where the data is and
 * Next draws these images natively; the website just points its pages here.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const C = {
  bg: "#0a0a0a",
  card: "#171717",
  line: "rgba(255,255,255,0.12)",
  white: "#ffffff",
  slate: "#94a3b8",
  yellow: "#ffff00",
  red: "#ff0000",
  green: "#008000",
};

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 500; style: "normal" }[]> | null = null;

/** Anton for the big type, Poppins for the rest, as on the site. Read once. */
function loadFonts() {
  if (!fonts) {
    const dir = join(process.cwd(), "assets", "fonts");
    fonts = Promise.all([
      readFile(join(dir, "Anton-Regular.ttf")),
      readFile(join(dir, "Poppins-Medium.ttf")),
    ]).then(([anton, poppins]) => [
      { name: "Anton", data: anton, weight: 400 as const, style: "normal" as const },
      { name: "Poppins", data: poppins, weight: 500 as const, style: "normal" as const },
    ]);
  }
  return fonts;
}

/**
 * A remote picture as a data URI the renderer can draw, or null. Only PNG,
 * JPEG and GIF: the renderer can't decode WebP, and a crest it can't draw
 * should give way to initials rather than fail the whole card. Photos saved
 * as "file.jpg (https://...)" by the Airtable import are read for the link.
 */
export async function picture(url: string | null | undefined): Promise<string | null> {
  let src = String(url ?? "").trim();
  if (!src) return null;
  const inBrackets = src.match(/\((https?:\/\/[^)\s]+)\)\s*$/);
  if (inBrackets) src = inBrackets[1];
  if (!/^https?:\/\//i.test(src)) return null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!["image/png", "image/jpeg", "image/jpg", "image/gif"].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 6 * 1024 * 1024) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export const initialsOf = (name: string | null | undefined) =>
  String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** The federation's crest, from rl_db's own public folder. */
export async function federationLogo(origin: string) {
  return picture(`${origin}/federationlogo.png`);
}

/** A round picture, or initials on dark when there is none. */
/** `fill`: photos fill the frame; crests (the default for square) sit inside it. */
export function Badge({ src, name, size, square = false, fill = !square }: { src: string | null; name: string; size: number; square?: boolean; fill?: boolean }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: square ? 24 : size,
        background: src ? "transparent" : C.card, border: src ? "none" : `2px solid ${C.line}`,
        display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={src} width={size} height={size} style={{ objectFit: fill ? "cover" : "contain", objectPosition: "top", width: size, height: size }} />
      ) : (
        <div style={{ display: "flex", fontFamily: "Anton", fontSize: size * 0.38, color: "rgba(255,255,255,0.35)" }}>{initialsOf(name)}</div>
      )}
    </div>
  );
}

/**
 * The frame every card shares: near-black, the Ghana flag across the top,
 * and the federation's crest with rlghana.com along the foot.
 */
export function Frame({ children, logo, eyebrow }: { children: React.ReactNode; logo: string | null; eyebrow?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bg, color: C.white, fontFamily: "Poppins" }}>
      <div style={{ display: "flex", height: 12, width: "100%" }}>
        <div style={{ flex: 1, background: C.red }} />
        <div style={{ flex: 1, background: C.yellow }} />
        <div style={{ flex: 1, background: C.green }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "44px 64px 0 64px" }}>
        {eyebrow ? (
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, color: C.yellow, textTransform: "uppercase" }}>{eyebrow}</div>
        ) : null}
        <div style={{ display: "flex", flex: 1 }}>{children}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 64px 36px 64px" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={logo} width={52} height={52} style={{ width: 52, height: 52, objectFit: "contain" }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: 26, color: C.yellow, letterSpacing: 3 }}>RLFG</div>
          <div style={{ display: "flex", fontSize: 18, color: C.slate }}>Rugby League Federation Ghana · rlghana.com</div>
        </div>
      </div>
    </div>
  );
}

/** A finished card, cached at the CDN for a day: a share is read once. */
export async function render(node: React.ReactElement) {
  return new ImageResponse(node, {
    ...OG_SIZE,
    fonts: await loadFonts(),
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}

/** A number with its label underneath, for the stats row. */
export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", marginRight: 48 }}>
      <div style={{ display: "flex", fontFamily: "Anton", fontSize: 64, lineHeight: 1 }}>{String(value)}</div>
      <div style={{ display: "flex", fontSize: 20, color: C.slate, textTransform: "uppercase", letterSpacing: 2, marginTop: 6 }}>{label}</div>
    </div>
  );
}
