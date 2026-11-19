import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * The code inside an ID card's QR: who the card is for, which group, which
 * year, and a signature only the server can make.
 *
 * Without the signature, anyone could take a profile address from the
 * public site, turn it into a QR code and print a card that scans as
 * genuine. With it, a code the federation didn't issue fails the check on
 * the verify page, and changing any part of a real one (the person, the
 * group, the year) breaks the signature.
 *
 * Signed with ID_CARD_SECRET, which lives only on the server. Changing that
 * secret invalidates every card printed before, which is the way to recall
 * them all if it ever leaks.
 */

export type CardKindLetter = "P" | "C" | "O" | "M" | "S";

const KIND_TO_LETTER: Record<string, CardKindLetter> = { player: "P", coach: "C", official: "O", management: "M", staff: "S" };
const LETTER_TO_KIND: Record<CardKindLetter, string> = { P: "player", C: "coach", O: "official", M: "management", S: "staff" };

function secret() {
  const s = process.env.ID_CARD_SECRET;
  if (!s || s.length < 32) throw new Error("ID_CARD_SECRET is not set");
  return s;
}

function sign(body: string) {
  // 96 bits of HMAC-SHA256: far beyond guessing, and short enough to keep
  // the QR code small and easy to scan.
  return createHmac("sha256", secret()).update(body).digest("base64url").slice(0, 16);
}

/** P + 32 hex characters + the year, then a dot and the signature. */
export function signCard(kind: string, id: string, year: string): string {
  const body = `${KIND_TO_LETTER[kind] ?? "P"}${id.replace(/-/g, "").toLowerCase()}${year}`;
  return `${body}.${sign(body)}`;
}

/** The card the code was issued for, or null if it isn't one the federation signed. */
export function readCard(token: string): { kind: string; id: string; year: string } | null {
  const m = String(token ?? "").match(/^([PCOMS])([0-9a-f]{32})(\d{4})\.([A-Za-z0-9_-]{16})$/);
  if (!m) return null;
  const [, letter, hex, year, sig] = m;
  let expected: string;
  try {
    expected = sign(`${letter}${hex}${year}`);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { kind: LETTER_TO_KIND[letter as CardKindLetter], id, year };
}
