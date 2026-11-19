import Link from "next/link";
import type { Metadata } from "next";
import { readCard } from "@/lib/cardToken";
import { getIdCardData, type CardKind } from "@/lib/idCard";
import { currentSuspensions } from "@/lib/suspensions";
import { createPublicClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify an RLFG card",
  robots: { index: false, follow: false },
};

const PROFILE: Partial<Record<CardKind, string>> = { player: "player", coach: "coach", official: "official" };

/**
 * Where the QR code on every ID card leads. The code carries a signature
 * only the server can make, so a QR built from any other link — a public
 * profile address, a typed URL, an edited one — is reported as not genuine.
 * A genuine card is then checked against today's record: revoked, expired,
 * or (for a player) suspended.
 *
 * The photo is shown so whoever scans can compare it with the person in
 * front of them: a genuine card in the wrong hands still scans as genuine.
 */
export default async function VerifyCard({ params }: { params: { token: string } }) {
  const card = readCard(decodeURIComponent(params.token));
  const d = card ? await getIdCardData(card.kind as CardKind, card.id) : null;

  if (!card || !d) {
    return (
      <Shell>
        <div className="bg-red-700 px-5 py-5">
          <p className="text-[11px] uppercase tracking-widest text-white/80">RLFG card check</p>
          <p className="font-display text-3xl">Not a genuine card</p>
          <p className="text-sm text-white/90 mt-1">This code was not issued by the Rugby League Federation Ghana.</p>
        </div>
        <p className="p-5 text-sm text-slate-300">
          Do not accept this card. If you think this is a mistake, contact the federation.
        </p>
      </Shell>
    );
  }

  const thisYear = new Date().getFullYear();
  const suspension =
    card.kind === "player" ? (await currentSuspensions(createPublicClient(), [card.id])).get(card.id) ?? null : null;
  // A card printed for an earlier year has run out even if the person is still registered.
  const outOfYear = Number(card.year) < thisYear;

  const state = d.revoked ? "revoked" : suspension ? "suspended" : outOfYear || d.expired ? "expired" : "valid";
  const banner = {
    valid: { text: "Valid", sub: `Genuine card · valid until 31 Dec ${card.year}`, cls: "bg-emerald-600" },
    expired: { text: "Expired", sub: `Genuine card, but it ran out on 31 Dec ${card.year}`, cls: "bg-amber-600" },
    suspended: {
      text: "Suspended",
      sub: suspension?.until ? `Genuine card · suspended until ${suspension.until}` : "Genuine card · currently suspended",
      cls: "bg-red-700",
    },
    revoked: { text: "Not valid", sub: "Genuine card, withdrawn by the federation", cls: "bg-red-700" },
  }[state];

  return (
    <Shell>
      <div className={`${banner.cls} px-5 py-4`}>
        <p className="text-[11px] uppercase tracking-widest text-white/80">RLFG card check</p>
        <p className="font-display text-3xl">{banner.text}</p>
        <p className="text-sm text-white/90">{banner.sub}</p>
      </div>
      <div className="p-5 flex gap-4 items-center">
        {d.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.photo} alt="" className="w-24 h-28 rounded-lg object-cover object-top border border-white/10" />
        ) : (
          <div className="w-24 h-28 rounded-lg bg-white/10 grid place-items-center font-display text-2xl text-white/40">
            {(d.firstName[0] ?? "") + (d.lastName[0] ?? "")}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight break-words">{d.name}</p>
          <p className="text-sm text-slate-300">{d.fields[0]?.value}</p>
          <p className="text-sm text-slate-400">{d.org}</p>
          <p className="text-xs text-slate-500 font-mono mt-1">{d.cardNumber}</p>
        </div>
      </div>
      <div className="px-5 pb-5 space-y-2">
        <p className="text-xs text-slate-400">
          <span className="text-white">Check the photo matches the person holding the card.</span> {d.theme.title.charAt(0) + d.theme.title.slice(1).toLowerCase()}, checked against the federation&rsquo;s record just now.
        </p>
        {PROFILE[card.kind as CardKind] && (
          <Link href={`/live/${PROFILE[card.kind as CardKind]}/${card.id}`} className="inline-block text-sm text-ghanaYellow-500 hover:underline">
            Open their profile →
          </Link>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 bg-neutral-900">{children}</div>
    </main>
  );
}
