import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";
import { signCard } from "@/lib/cardToken";
import { appOrigin } from "@/lib/liveShare";

/**
 * Identification cards, issued by the federation only, for everyone who
 * needs one on a match day: players, coaches, match officials, federation
 * management, team staff and media.
 *
 * Bank-card size (85.6 × 54 mm, ISO CR80) drawn at 300 dpi. Each group has
 * its own colours so a steward can tell at a glance who is who. The back
 * carries a QR code: to the person's live profile where one exists, or to a
 * public verify page that says whether the card is still valid.
 */

export const CARD = { width: 1012, height: 638 };

export type CardKind = "player" | "coach" | "official" | "management" | "staff";
export const CARD_KINDS: CardKind[] = ["player", "coach", "official", "management", "staff"];

type Theme = { from: string; mid: string; to: string; accent: string; frame: string; title: string; letter: string };

/** Each group's colours and the title printed on its card. */
export const THEMES: Record<string, Theme> = {
  player: { from: "#081529", mid: "#0e1e36", to: "#13294a", accent: "#e8b325", frame: "#1b2c48", title: "PLAYER IDENTIFICATION CARD", letter: "" },
  coach: { from: "#04211a", mid: "#073427", to: "#0c4634", accent: "#e8b325", frame: "#0f4a38", title: "COACH ACCREDITATION", letter: "C" },
  official: { from: "#0d0d0d", mid: "#1a1a1a", to: "#262626", accent: "#f4e04d", frame: "#2e2e2e", title: "MATCH OFFICIAL ACCREDITATION", letter: "O" },
  management: { from: "#2e0710", mid: "#4a0d19", to: "#5e1322", accent: "#e8b325", frame: "#6a1a2a", title: "FEDERATION MANAGEMENT", letter: "M" },
  team_staff: { from: "#04222a", mid: "#073640", to: "#0b4a55", accent: "#5fd3c6", frame: "#0f5560", title: "TEAM STAFF ACCREDITATION", letter: "S" },
  medical: { from: "#04222a", mid: "#073640", to: "#0b4a55", accent: "#5fd3c6", frame: "#0f5560", title: "MEDICAL ACCREDITATION", letter: "S" },
  volunteer: { from: "#04222a", mid: "#073640", to: "#0b4a55", accent: "#5fd3c6", frame: "#0f5560", title: "VOLUNTEER ACCREDITATION", letter: "S" },
  media: { from: "#170828", mid: "#24103f", to: "#331659", accent: "#c9b0ff", frame: "#3a1f63", title: "MEDIA ACCREDITATION", letter: "S" },
  federation_staff: { from: "#2e0710", mid: "#4a0d19", to: "#5e1322", accent: "#e8b325", frame: "#6a1a2a", title: "FEDERATION STAFF", letter: "S" },
};

export const KIND_LABEL: Record<CardKind, string> = {
  player: "Players",
  coach: "Coaches",
  official: "Match officials",
  management: "Management",
  staff: "Staff & media",
};

export const STAFF_CATEGORIES: { key: string; label: string }[] = [
  { key: "team_staff", label: "Team staff" },
  { key: "media", label: "Media" },
  { key: "federation_staff", label: "Federation staff" },
  { key: "medical", label: "Medical" },
  { key: "volunteer", label: "Volunteer" },
];

const INK = "#0b1526";
const SOFT = "rgba(255,255,255,0.62)";
const IVORY = "#f7f5ee";

export type IdCardData = {
  kind: CardKind;
  id: string;
  theme: Theme;
  /** The noun the back of the card uses: "player", "coach"… */
  holderNoun: string;
  name: string;
  firstName: string;
  lastName: string;
  photo: string | null;
  /** The line under the name: a club with its crest, or an organisation. */
  org: string;
  orgLogo: string | null;
  fields: { label: string; value: string }[];
  cardNumber: string;
  season: string | null;
  validUntil: string | null;
  expired: boolean;
  revoked: boolean;
  verifyUrl: string;
  issuedOn: string;
};

/** RLFG-D70A-2CA6 for players; RLFG-C-1A2B-3C4D for everyone else. */
export function cardNumberFor(id: string, kind: CardKind = "player", letter?: string) {
  const hex = id.replace(/-/g, "").toUpperCase();
  const l = letter ?? THEMES[kind === "staff" ? "team_staff" : kind]?.letter ?? "";
  return l ? `RLFG-${l}-${hex.slice(0, 4)}-${hex.slice(4, 8)}` : `RLFG-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
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
    ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

const cap = (s: string | null | undefined) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()) : "—");

/** "Kofi Adusei Abah" → first "Kofi Adusei", last "Abah". */
function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { first: full.trim(), last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

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
    crest = readFile(join(process.cwd(), "public", "federationlogo.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`);
  }
  return crest;
}

let fonts: Promise<any[]> | null = null;
function loadFonts() {
  if (!fonts) {
    const dir = join(process.cwd(), "assets", "fonts");
    fonts = Promise.all([readFile(join(dir, "Anton-Regular.ttf")), readFile(join(dir, "Poppins-Medium.ttf"))]).then(([anton, poppins]) => [
      { name: "Anton", data: anton, weight: 400, style: "normal" },
      { name: "Poppins", data: poppins, weight: 500, style: "normal" },
    ]);
  }
  return fonts;
}

const origin = () => appOrigin().toString().replace(/\/$/, "");
const today = () => new Date().toISOString().slice(0, 10);

/** Everyone else's card runs for the current calendar year, 1 January to 31 December. */
async function issuingSeason() {
  const year = String(new Date().getFullYear());
  return { season: year, endsOn: `${year}-12-31` };
}

/**
 * The address the QR code opens: the verify page, with a code signed by the
 * server so a QR made from any other link fails the check.
 */
const verifyLink = (kind: string, id: string, year: string | null) =>
  `${origin()}/verify/${signCard(kind, id, year ?? String(new Date().getFullYear()))}`;

async function team(teamId: string | null | undefined) {
  if (!teamId) return null;
  const { data } = await createAdminClient().from("teams").select("name, logo_url").eq("team_id", teamId).maybeSingle();
  return data as { name: string; logo_url: string | null } | null;
}

/** Everything a card shows, read with the service key (federation only). */
export async function getIdCardData(kind: CardKind, id: string): Promise<IdCardData | null> {
  const supabase = createAdminClient();
  const issuedOn = day(today())!;

  if (kind === "player") {
    const { data: p } = await supabase
      .from("players")
      .select("player_id, first_name, last_name, photo_url, position, jersey_number, category, gender, team_id")
      .eq("player_id", id)
      .maybeSingle();
    if (!p) return null;
    const [club, { data: regs }] = await Promise.all([
      team(p.team_id),
      supabase.from("player_registrations").select("season_year").eq("player_id", id).order("season_year", { ascending: false }),
    ]);
    // Cards run for a calendar year, 1 January to 31 December: the year the
    // player is registered for.
    const regSeason = (regs ?? [])[0]?.season_year != null ? String((regs ?? [])[0].season_year) : null;
    const season = regSeason ?? String(new Date().getFullYear());
    // The first year they registered with the federation: true for every
    // registered player, and it doesn't change the way a shirt number does.
    const years = ((regs ?? []) as any[]).map((r) => Number(r.season_year)).filter(Number.isFinite);
    const memberSince = years.length ? String(Math.min(...years)) : "—";
    const endsOn = `${season}-12-31`;
    const theme = THEMES.player;
    return {
      kind, id, theme, holderNoun: "player",
      name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
      firstName: p.first_name ?? "", lastName: p.last_name ?? "",
      photo: await asPng(p.photo_url, 600),
      org: club?.name ?? "Unattached", orgLogo: await asPng(club?.logo_url, 160),
      fields: [
        { label: "Position", value: p.position || "—" },
        { label: "Grade", value: gradeOf(p.category, p.gender) },
        { label: "Member since", value: memberSince },
        { label: "Valid until", value: day(endsOn) ?? "—" },
      ],
      cardNumber: cardNumberFor(id, "player"),
      season, validUntil: day(endsOn),
      expired: !regSeason || (!!endsOn && endsOn < today()), revoked: false,
      verifyUrl: verifyLink("player", id, season), issuedOn,
    };
  }

  const { season, endsOn } = await issuingSeason();

  if (kind === "coach") {
    const { data: c } = await supabase.from("coaches").select("*").eq("coach_id", id).maybeSingle();
    if (!c) return null;
    const club = await team(c.team_id);
    const theme = THEMES.coach;
    return {
      kind, id, theme, holderNoun: "coach",
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(), firstName: c.first_name ?? "", lastName: c.last_name ?? "",
      photo: await asPng(c.photo_url, 600),
      org: club?.name ?? "Rugby League Federation Ghana", orgLogo: await asPng(club?.logo_url, 160),
      fields: [
        { label: "Role", value: cap(c.role) },
        { label: "Qualification", value: c.qualification || "—" },
        { label: "Region", value: c.region || "—" },
        { label: "Valid until", value: day(endsOn) ?? "—" },
      ],
      cardNumber: cardNumberFor(id, "coach"), season, validUntil: day(endsOn),
      expired: endsOn < today(), revoked: String(c.status ?? "active").toLowerCase() !== "active",
      verifyUrl: verifyLink("coach", id, season), issuedOn,
    };
  }

  if (kind === "official") {
    const { data: o } = await supabase.from("officials").select("*").eq("official_id", id).maybeSingle();
    if (!o) return null;
    const theme = THEMES.official;
    return {
      kind, id, theme, holderNoun: "match official",
      name: `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim(), firstName: o.first_name ?? "", lastName: o.last_name ?? "",
      photo: await asPng(o.photo_url, 600),
      org: "Rugby League Federation Ghana", orgLogo: null,
      fields: [
        { label: "Role", value: cap(o.role) },
        { label: "Level", value: o.level || "—" },
        { label: "Region", value: o.region || "—" },
        { label: "Valid until", value: day(endsOn) ?? "—" },
      ],
      cardNumber: cardNumberFor(id, "official"), season, validUntil: day(endsOn),
      expired: endsOn < today(), revoked: String(o.status ?? "active").toLowerCase() !== "active",
      verifyUrl: verifyLink("official", id, season), issuedOn,
    };
  }

  if (kind === "management") {
    const { data: m } = await supabase.from("people").select("*").eq("person_id", id).maybeSingle();
    if (!m) return null;
    const { first, last } = splitName(m.name ?? "");
    const theme = THEMES.management;
    return {
      kind, id, theme, holderNoun: "member of the federation's management",
      name: m.name ?? "", firstName: first, lastName: last,
      photo: await asPng(m.photo_url, 600),
      org: "Rugby League Federation Ghana", orgLogo: null,
      fields: [
        { label: "Position", value: m.role || "—" },
        { label: "Body", value: m.group_name === "board" ? "The Board" : m.group_name === "committee" ? "Management Committee" : cap(m.group_name) },
        { label: "Season", value: season ?? "—" },
        { label: "Valid until", value: day(endsOn) ?? "—" },
      ],
      cardNumber: cardNumberFor(id, "management"), season, validUntil: day(endsOn),
      expired: endsOn < today(), revoked: String(m.status ?? "active").toLowerCase() === "archived",
      verifyUrl: verifyLink("management", id, season), issuedOn,
    };
  }

  // Staff & media, from the accreditations list.
  const { data: a } = await supabase.from("accreditations").select("*").eq("accreditation_id", id).maybeSingle();
  if (!a) return null;
  const club = await team(a.team_id);
  const { first, last } = splitName(a.full_name ?? "");
  const theme = THEMES[a.category] ?? THEMES.team_staff;
  const until = a.valid_until ?? endsOn;
  const categoryLabel = STAFF_CATEGORIES.find((c) => c.key === a.category)?.label ?? "Staff";
  return {
    kind, id, theme,
    holderNoun:
      ({ media: "member of the media", team_staff: "member of club staff", medical: "member of the medical staff", volunteer: "volunteer", federation_staff: "member of the federation's staff" } as Record<string, string>)[a.category] ?? "member of staff",
    name: a.full_name ?? "", firstName: first, lastName: last,
    photo: await asPng(a.photo_url, 600),
    org: club?.name ?? a.organisation ?? "Rugby League Federation Ghana", orgLogo: await asPng(club?.logo_url, 160),
    fields: [
      { label: "Role", value: a.role || "—" },
      { label: "Category", value: categoryLabel },
      { label: "Season", value: season ?? "—" },
      { label: "Valid until", value: day(until) ?? "—" },
    ],
    cardNumber: cardNumberFor(id, "staff", theme.letter), season, validUntil: day(until),
    expired: until < today(), revoked: a.status === "revoked",
    verifyUrl: verifyLink("staff", id, season), issuedOn,
  };
}

const initials = (d: IdCardData) => `${d.firstName[0] ?? ""}${d.lastName[0] ?? ""}`.toUpperCase() || "RL";

function FlagEdge({ vertical }: { vertical?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: vertical ? "column" : "row", width: vertical ? 14 : "100%", height: vertical ? "100%" : 10 }}>
      <div style={{ flex: 1, background: "#ce1126" }} />
      <div style={{ flex: 1, background: "#fcd116" }} />
      <div style={{ flex: 1, background: "#006b3f" }} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: 280, marginBottom: 18 }}>
      <div style={{ display: "flex", fontSize: 14, letterSpacing: 3, color: SOFT, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", fontSize: value.length > 18 ? 20 : 25, color: "#ffffff", marginTop: 2 }}>{value}</div>
    </div>
  );
}

function Front({ d, logo }: { d: IdCardData; logo: string }) {
  const t = d.theme;
  const long = d.name.length > 18;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: `linear-gradient(135deg, ${t.from} 0%, ${t.mid} 60%, ${t.to} 100%)`, color: "#fff", fontFamily: "Poppins", position: "relative", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logo} width={520} height={600} style={{ position: "absolute", right: -120, top: 40, width: 520, height: 600, objectFit: "contain", opacity: 0.06 }} />
      <FlagEdge vertical />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "34px 44px 0 40px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={logo} width={66} height={76} style={{ width: 66, height: 76, objectFit: "contain" }} />
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 18, flex: 1 }}>
            <div style={{ display: "flex", fontSize: 19, letterSpacing: 3.5, color: "#ffffff" }}>RUGBY LEAGUE FEDERATION GHANA</div>
            <div style={{ display: "flex", fontSize: 14, letterSpacing: 5, color: t.accent, marginTop: 2 }}>{t.title}</div>
          </div>
          <div style={{ display: "flex", border: `2px solid ${t.accent}`, borderRadius: 40, padding: "4px 18px", fontFamily: "Anton", fontSize: 26, color: t.accent, letterSpacing: 2 }}>
            {d.season ?? ""}
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, marginTop: 26, alignItems: "flex-start" }}>
          <div style={{ display: "flex", width: 290, height: 372, borderRadius: 22, border: `4px solid ${t.accent}`, overflow: "hidden", background: t.frame, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
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
              <div style={{ display: "flex", color: t.accent }}>{d.lastName}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", marginTop: 14, marginBottom: 22 }}>
              {d.orgLogo ? (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={d.orgLogo} width={40} height={40} style={{ width: 40, height: 40, objectFit: "contain", marginRight: 12 }} />
              ) : null}
              <div style={{ display: "flex", fontSize: d.org.length > 26 ? 21 : 26, color: "#ffffff" }}>{d.org}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", width: 560 }}>
              {d.fields.map((f) => (
                <Field key={f.label} label={f.label} value={f.value} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.14)", padding: "14px 0 22px 0" }}>
          <div style={{ display: "flex", fontSize: 18, letterSpacing: 4, color: "#ffffff" }}>{d.cardNumber}</div>
          <div style={{ display: "flex", fontSize: 15, letterSpacing: 2, color: SOFT }}>rlghana.com</div>
        </div>
      </div>
    </div>
  );
}

function Back({ d, logo, qr }: { d: IdCardData; logo: string; qr: string }) {
  const statement =
    d.kind === "player"
      ? "This card identifies the holder as a player registered with the Rugby League Federation Ghana for the year shown. It must be shown to match officials on request, and remains the property of the federation."
      : `This card accredits the holder as a ${d.holderNoun} at Rugby League Federation Ghana events for the year shown. It must be shown on request, and remains the property of the federation.`;
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: IVORY, color: INK, fontFamily: "Poppins", position: "relative", overflow: "hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={logo} width={460} height={530} style={{ position: "absolute", right: -90, bottom: -90, width: 460, height: 530, objectFit: "contain", opacity: 0.07 }} />
      <FlagEdge />
      <div style={{ display: "flex", height: 8, width: "100%", background: d.theme.mid }} />
      <div style={{ display: "flex", flex: 1, padding: "34px 46px 0 46px" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 296 }}>
          <div style={{ display: "flex", background: "#ffffff", padding: 14, borderRadius: 18, border: "2px solid #e3e0d4" }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={qr} width={262} height={262} style={{ width: 262, height: 262 }} />
          </div>
          <div style={{ display: "flex", fontSize: 15, letterSpacing: 3, marginTop: 14, color: INK }}>SCAN TO VERIFY</div>
          <div style={{ display: "flex", fontSize: 13, color: "#5d6577", marginTop: 4 }}>
            Checks the card is genuine and valid
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, marginLeft: 42 }}>
          <div style={{ display: "flex", fontSize: 13, letterSpacing: 4, color: d.theme.mid }}>{d.theme.title}</div>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: d.name.length > 24 ? 28 : 34, letterSpacing: 1, color: INK, marginTop: 2 }}>{d.name.toUpperCase()}</div>
          <div style={{ display: "flex", fontSize: 17, color: "#5d6577", marginTop: 2 }}>
            {d.cardNumber} · {d.org}
          </div>
          <div style={{ display: "flex", fontSize: 16, lineHeight: 1.5, marginTop: 18, color: INK }}>{statement}</div>
          <div style={{ display: "flex", marginTop: 20 }}>
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

/** One side of a card as a PNG. Never cached: it carries today's status. */
export async function renderIdCard(d: IdCardData, side: "front" | "back") {
  const logo = await federationCrest();
  const node =
    side === "front" ? (
      <Front d={d} logo={logo} />
    ) : (
      <Back d={d} logo={logo} qr={await QRCode.toDataURL(d.verifyUrl, { margin: 0, width: 524, errorCorrectionLevel: "M", color: { dark: INK, light: "#ffffff" } })} />
    );
  return new ImageResponse(node, { ...CARD, fonts: await loadFonts(), headers: { "Cache-Control": "private, no-store" } });
}
