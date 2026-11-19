import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";
import { getSeasonState } from "@/lib/seasons";
import { appOrigin } from "@/lib/liveShare";

/**
 * Player identification cards, issued by the federation only.
 *
 * Bank-card size (85.6 × 54 mm, ISO CR80) drawn at 300 dpi, so the PNG
 * prints sharp on a card printer or on paper for laminating. The front says
 * who the player is; the back carries a QR code to their live profile, so
 * a match official can check their club and any suspension on the day
 * rather than trusting a card that may be out of date.
 */

export const CARD = { width: 1012, height: 638 };

const NAVY = "#081529";
const NAVY_2 = "#0e1e36";
const GOLD = "#e8b325";
const INK = "#0b1526";
const SOFT = "rgba(255,255,255,0.62)";
const IVORY = "#f7f5ee";

export type IdCardData = {
  playerId: string;
  name: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  club: string | null;
  clubLogo: string | null;
  position: string | null;
  grade: string;
  jersey: number | null;
  cardNumber: string;
  season: string | null;
  validUntil: string | null;
  /** True when the card's season is over or the player isn't registered for it. */
  expired: boolean;
  registered: boolean;
  profileUrl: string;
  issuedOn: string;
};

/** RLFG-D70A-2CA6: stable for the player across seasons, easy to read out. */
export function cardNumberFor(playerId: string) {
  const hex = playerId.replace(/-/g, "").toUpperCase();
  return `RLFG-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

function gradeOf(category: string | null, gender: string | null): string {
  const c = String(category ?? "").toLowerCase().replace(/\s+/g, "_");
  const female = String(gender ?? "").toLowerCase() === "female";
  if (c.startsWith("youth")) return female ? "Youth Girls" : "Youth Boys";
  if (c.includes("women")) return "Senior Women";
  if (c.includes("men")) return "Senior Men";
  return female ? "Senior Women" : "Senior Men";
}

const day = (iso: string | null) =>
  iso
    ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

/**
 * Any picture as a PNG data URI the renderer can draw, resized on the way.
 * The renderer can't read WebP, and uploads are now stored as WebP, so
 * everything goes through sharp. A picture that can't be fetched gives way
 * to initials rather than failing the card.
 */
async function asPng(url: string | null | undefined, size: number): Promise<string | null> {
  let src = String(url ?? "").trim();
  const inBrackets = src.match(/\((https?:\/\/[^)\s]+)\)\s*$/);
  if (inBrackets) src = inBrackets[1];
  if (!/^https?:\/\//i.test(src)) return null;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const png = await sharp(Buffer.from(await res.arrayBuffer()))
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

let crest: Promise<string> | null = null;
function federationCrest() {
  if (!crest) {
    crest = readFile(join(process.cwd(), "public", "federationlogo.png")).then(
      (b) => `data:image/png;base64,${b.toString("base64")}`
    );
  }
  return crest;
}

let fonts: Promise<any[]> | null = null;
function loadFonts() {
  if (!fonts) {
    const dir = join(process.cwd(), "assets", "fonts");
    fonts = Promise.all([readFile(join(dir, "Anton-Regular.ttf")), readFile(join(dir, "Poppins-Medium.ttf"))]).then(
      ([anton, poppins]) => [
        { name: "Anton", data: anton, weight: 400, style: "normal" },
        { name: "Poppins", data: poppins, weight: 500, style: "normal" },
      ]
    );
  }
  return fonts;
}

/** Everything the card shows, read with the service key (federation only). */
export async function getIdCardData(playerId: string): Promise<IdCardData | null> {
  const supabase = createAdminClient();
  const { data: p } = await supabase
    .from("players")
    .select("player_id, first_name, last_name, photo_url, position, jersey_number, category, gender, team_id")
    .eq("player_id", playerId)
    .maybeSingle();
  if (!p) return null;

  const [{ data: team }, { data: regs }, state] = await Promise.all([
    p.team_id
      ? supabase.from("teams").select("name, logo_url").eq("team_id", p.team_id).maybeSingle()
      : Promise.resolve({ data: null as any }),
    supabase.from("player_registrations").select("season_year").eq("player_id", playerId).order("season_year", { ascending: false }).limit(1),
    getSeasonState(),
  ]);

  // Valid for the season the player is registered in, until that season ends.
  const regSeason = (regs ?? [])[0]?.season_year != null ? String((regs ?? [])[0].season_year) : null;
  const season = regSeason ?? state.season;
  const row = state.every.find((s) => s.season === season) ?? null;
  const validUntil = row?.endsOn ?? (season ? `${season}-12-31` : null);
  const today = new Date().toISOString().slice(0, 10);

  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return {
    playerId,
    name,
    firstName: p.first_name ?? "",
    lastName: p.last_name ?? "",
    photo: await asPng(p.photo_url, 600),
    club: team?.name ?? null,
    clubLogo: await asPng(team?.logo_url, 160),
    position: p.position ?? null,
    grade: gradeOf(p.category, p.gender),
    jersey: p.jersey_number ?? null,
    cardNumber: cardNumberFor(playerId),
    season,
    validUntil: day(validUntil),
    expired: !regSeason || (!!validUntil && validUntil < today),
    registered: !!regSeason,
    profileUrl: `${appOrigin().toString().replace(/\/$/, "")}/live/player/${playerId}`,
    issuedOn: day(today)!,
  };
}

const initials = (d: IdCardData) =>
  `${d.firstName[0] ?? ""}${d.lastName[0] ?? ""}`.toUpperCase() || "RL";

function FlagEdge({ vertical }: { vertical?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", width: vertical ? 14 : "100%", height: vertical ? "100%" : 10 }}>
      <div style={{ flex: 1, background: "#ce1126" }} />
      <div style={{ flex: 1, background: "#fcd116", display: "flex", alignItems: "center", justifyContent: "center" }} />
      <div style={{ flex: 1, background: "#006b3f" }} />
    </div>
  );
}

function Field({ label, value, width }: { label: string; value: string; width: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width, marginBottom: 18 }}>
      <div style={{ display: "flex", fontSize: 14, letterSpacing: 3, color: SOFT, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", fontSize: 25, color: "#ffffff", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Front({ d, logo }: { d: IdCardData; logo: string }) {
  const long = d.name.length > 18;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_2} 60%, #13294a 100%)`, color: "#fff", fontFamily: "Poppins", position: "relative", overflow: "hidden" }}>
      {/* The crest, large and faint, behind everything */}
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logo} width={520} height={600} style={{ position: "absolute", right: -120, top: 40, width: 520, height: 600, objectFit: "contain", opacity: 0.06 }} />
      <FlagEdge vertical />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "34px 44px 0 40px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={logo} width={66} height={76} style={{ width: 66, height: 76, objectFit: "contain" }} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 18, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 19, letterSpacing: 3.5, color: "#ffffff" }}>RUGBY LEAGUE FEDERATION GHANA</div>
            <div style={{ display: "flex", fontSize: 14, letterSpacing: 5, color: GOLD, marginTop: 2 }}>PLAYER IDENTIFICATION CARD</div>
          </div>
          <div style={{ display: "flex", border: `2px solid ${GOLD}`, borderRadius: 40, padding: "4px 18px", fontFamily: "Anton", fontSize: 26, color: GOLD, letterSpacing: 2 }}>
            {d.season ?? ""}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, marginTop: 26, alignItems: "flex-start" }}>
          <div style={{ display: "flex", width: 290, height: 372, borderRadius: 22, border: `4px solid ${GOLD}`, overflow: "hidden", background: "#1b2c48", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {d.photo ? (
              // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
              <img src={d.photo} width={282} height={364} style={{ width: 282, height: 364, objectFit: "cover", objectPosition: "top" }} />
            ) : (
              <div style={{ display: "flex", fontFamily: "Anton", fontSize: 120, color: "rgba(255,255,255,0.28)" }}>{initials(d)}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginLeft: 40, flex: 1, paddingTop: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Anton", fontSize: long ? 46 : 56, lineHeight: 1.02, textTransform: "uppercase", letterSpacing: 1 }}>
              <div style={{ display: "flex" }}>{d.firstName}</div>
              <div style={{ display: "flex", color: GOLD }}>{d.lastName}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 14, marginBottom: 22 }}>
              {d.clubLogo ? (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={d.clubLogo} width={40} height={40} style={{ width: 40, height: 40, objectFit: "contain", marginRight: 12 }} />
              ) : null}
              <div style={{ display: "flex", fontSize: 26, color: "#ffffff" }}>{d.club ?? "Unattached"}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", width: 560 }}>
              <Field label="Position" value={d.position || "—"} width={280} />
              <Field label="Grade" value={d.grade} width={280} />
              <Field label="Shirt" value={d.jersey != null ? `#${d.jersey}` : "—"} width={280} />
              <Field label="Valid until" value={d.validUntil ?? "—"} width={280} />
            </div>
          </div>
        </div>

        {/* Foot */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.14)", padding: "14px 0 22px 0" }}>
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: "#ffffff" }}>{d.cardNumber}</div>
          <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: SOFT }}>rlghana.com</div>
        </div>
      </div>
    </div>
  );
}

function Back({ d, logo, qr }: { d: IdCardData; logo: string; qr: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: IVORY, color: INK, fontFamily: "Poppins", position: "relative", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logo} width={460} height={530} style={{ position: "absolute", right: -90, bottom: -90, width: 460, height: 530, objectFit: "contain", opacity: 0.07 }} />
      <FlagEdge />
      <div style={{ display: "flex", flex: 1, padding: "38px 46px 0 46px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 296 }}>
          <div style={{ display: "flex", background: "#ffffff", padding: 14, borderRadius: 18, border: "2px solid #e3e0d4" }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={qr} width={262} height={262} style={{ width: 262, height: 262 }} />
          </div>
          <div style={{ display: "flex", fontSize: 15, letterSpacing: 3, marginTop: 14, color: INK }}>SCAN TO VERIFY</div>
          <div style={{ display: "flex", fontSize: 13, color: "#5d6577", marginTop: 4, textAlign: "center" }}>Club, status and any suspension</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 42 }}>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: 34, letterSpacing: 1, color: NAVY }}>{d.name.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 17, color: "#5d6577", marginTop: 2 }}>
            {d.cardNumber} · {d.club ?? "Unattached"}
          </div>
          <div style={{ display: "flex", fontSize: 16.5, lineHeight: 1.5, marginTop: 20, color: INK }}>
            This card identifies the holder as a player registered with the Rugby League Federation Ghana for the season shown. It must be shown to match officials on request, and remains the property of the federation.
          </div>
          <div style={{ display: "flex", marginTop: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", width: 200 }}>
              <div style={{ display: "flex", fontSize: 13, letterSpacing: 3, color: "#7a8193" }}>ISSUED</div>
              <div style={{ display: "flex", fontSize: 20 }}>{d.issuedOn}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: 220 }}>
              <div style={{ display: "flex", fontSize: 13, letterSpacing: 3, color: "#7a8193" }}>VALID UNTIL</div>
              <div style={{ display: "flex", fontSize: 20 }}>{d.validUntil ?? "—"}</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 46px 30px 46px" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 330 }}>
          <div style={{ display: "flex", borderTop: `2px solid ${INK}`, width: 330 }} />
          <div style={{ display: "flex", fontSize: 14, color: "#5d6577", marginTop: 6 }}>General Manager, RLFG</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: 13, color: "#5d6577" }}>If found, please return to</div>
          <div style={{ display: "flex", fontSize: 15, color: INK }}>Rugby League Federation Ghana · rlghana.com</div>
        </div>
      </div>
    </div>
  );
}

/** One side of the card as a PNG. Never cached: it carries today's status. */
export async function renderIdCard(d: IdCardData, side: "front" | "back") {
  const logo = await federationCrest();
  const node =
    side === "front" ? (
      <Front d={d} logo={logo} />
    ) : (
      <Back
        d={d}
        logo={logo}
        qr={await QRCode.toDataURL(d.profileUrl, { margin: 0, width: 464, errorCorrectionLevel: "M", color: { dark: INK, light: "#ffffff" } })}
      />
    );
  return new ImageResponse(node, {
    ...CARD,
    fonts: await loadFonts(),
    headers: { "Cache-Control": "private, no-store" },
  });
}
