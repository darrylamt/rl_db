import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/server";
import { cardNumberFor } from "@/lib/idCard";
import { signCard } from "@/lib/cardToken";
import { appOrigin } from "@/lib/liveShare";
import type { TeamSheetData, TransferSheetData } from "@/lib/printDocs";
import { getSignatory } from "@/lib/signature";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const fullName = (p: any) => `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();

/** A club's side for one match, ready to print. Null if the fixture isn't theirs. */
export async function getTeamSheetData(fixtureId: string, teamId: string, crest = "/federationlogo.png"): Promise<TeamSheetData | null> {
  const supabase = createAdminClient();
  const [{ data: f }, { data: sheet }, { data: lineup }] = await Promise.all([
    supabase
      .from("fixtures")
      .select("fixture_id, scheduled_date, scheduled_time, round, home_team_id, away_team_id, home:home_team_id(name), away:away_team_id(name), venue:venue_id(name), competition:competition_id(name)")
      .eq("fixture_id", fixtureId)
      .maybeSingle(),
    supabase.from("team_sheets").select("status, submitted_at, head_coach_id, assistant_coach_id").eq("fixture_id", fixtureId).eq("team_id", teamId).maybeSingle(),
    supabase
      .from("match_lineups")
      .select("player_id, jersey_number, position, is_starter, player:player_id(first_name, last_name)")
      .eq("fixture_id", fixtureId)
      .eq("team_id", teamId),
  ]);
  if (!f || (f.home_team_id !== teamId && f.away_team_id !== teamId)) return null;

  const coachIds = [sheet?.head_coach_id, sheet?.assistant_coach_id].filter(Boolean) as string[];
  const { data: coaches } = coachIds.length
    ? await supabase.from("coaches").select("coach_id, first_name, last_name").in("coach_id", coachIds)
    : { data: [] as any[] };
  const coachName = (id: string | null | undefined) => {
    const c = (coaches ?? []).find((x: any) => x.coach_id === id);
    return c ? fullName(c) : null;
  };

  const home = f.home_team_id === teamId;
  const rows = ((lineup ?? []) as any[])
    .map((l) => ({
      starter: l.is_starter !== false,
      jersey: l.jersey_number ?? null,
      name: fullName(one(l.player)),
      position: l.position ?? null,
      card: cardNumberFor(l.player_id),
    }))
    // Numbered players in order, then those without a number, by name.
    .sort((a, b) => (a.jersey ?? 999) - (b.jersey ?? 999) || a.name.localeCompare(b.name));

  return {
    crest,
    club: (one(home ? f.home : f.away) as any)?.name ?? "Club",
    opponent: (one(home ? f.away : f.home) as any)?.name ?? "Opponent",
    home,
    competition: (one(f.competition) as any)?.name ?? "",
    round: f.round ?? null,
    date: f.scheduled_date ?? null,
    time: f.scheduled_time ?? null,
    venue: (one(f.venue) as any)?.name ?? null,
    status: sheet?.status ?? "not started",
    submittedAt: sheet?.submitted_at ?? null,
    headCoach: coachName(sheet?.head_coach_id),
    assistantCoach: coachName(sheet?.assistant_coach_id),
    starters: rows.filter((r) => r.starter).map(({ starter, ...r }) => r),
    bench: rows.filter((r) => !r.starter).map(({ starter, ...r }) => r),
  };
}

function grade(category: string | null, gender: string | null) {
  const c = String(category ?? "").toLowerCase();
  const female = String(gender ?? "").toLowerCase() === "female";
  if (c.startsWith("youth")) return female ? "Youth Girls" : "Youth Boys";
  if (c.includes("women")) return "Senior Women";
  return female ? "Senior Women" : "Senior Men";
}

/** "TR-1A2B-3C4D": the transfer's own reference, from its id. */
export const transferReference = (id: string) => {
  const hex = id.replace(/-/g, "").toUpperCase();
  return `TR-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
};

/** The QR for a transfer sheet: the verify page with a server-signed code. */
export async function transferQr(id: string, year: string) {
  const verifyUrl = `${appOrigin().toString().replace(/\/$/, "")}/verify/${signCard("transfer", id, year)}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 360, errorCorrectionLevel: "M" });
  return { verifyUrl, qr };
}

/**
 * A transfer or loan, with its four signatures: each party's approval in its
 * own account, and when. Raw so the page can decide who may see it.
 */
export async function getTransferSheetData(requestId: string, crest = "/federationlogo.png") {
  const supabase = createAdminClient();
  const { data: r } = await supabase
    .from("transfer_requests")
    .select(
      "request_id, player_id, from_team_id, to_team_id, kind, loan_until, status, requested_by, requested_at, club_answered_by, club_answered_at, player_answered_at, reviewed_by, reviewed_at, fee, levy, player:player_id(first_name, last_name, position, photo_url, category, gender), from_team:from_team_id(name, logo_url), to_team:to_team_id(name, logo_url)"
    )
    .eq("request_id", requestId)
    .maybeSingle();
  if (!r) return null;

  const userIds = [r.requested_by, r.club_answered_by, r.reviewed_by].filter(Boolean) as string[];
  const [{ data: users }, { data: playerAccount }] = await Promise.all([
    userIds.length ? supabase.from("app_users").select("user_id, email").in("user_id", userIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from("app_users").select("email").eq("player_id", r.player_id).maybeSingle(),
  ]);
  const emailOf = (id: string | null) => ((users ?? []) as any[]).find((u) => u.user_id === id)?.email ?? null;

  const p: any = one(r.player);
  const from: any = one(r.from_team);
  const to: any = one(r.to_team);
  const loan = r.kind === "loan";
  const year = String((r.reviewed_at ?? r.requested_at ?? new Date().toISOString()).slice(0, 4));
  const { verifyUrl, qr } = await transferQr(r.request_id, year);
  const free = !from;

  const data: TransferSheetData = {
    crest,
    reference: transferReference(r.request_id),
    kind: loan ? "loan" : "transfer",
    loanUntil: r.loan_until ?? null,
    player: { name: fullName(p), card: cardNumberFor(r.player_id), position: p?.position ?? null, grade: grade(p?.category, p?.gender), photo: p?.photo_url ?? null },
    from: { name: from?.name ?? "No club (free agent)", logo: from?.logo_url ?? null },
    to: { name: to?.name ?? "—", logo: to?.logo_url ?? null },
    fee: r.fee ?? null,
    levy: r.levy ?? null,
    effective: r.reviewed_at ?? null,
    signatures: [
      { party: "Buying club", name: to?.name ?? "—", by: emailOf(r.requested_by), at: r.requested_at, what: `Requested the ${loan ? "loan" : "transfer"}` },
      free
        ? { party: "Selling club", name: "None — free agent", by: null, at: r.requested_at, what: "No club to release the player" }
        : { party: "Selling club", name: from?.name ?? "—", by: emailOf(r.club_answered_by), at: r.club_answered_at, what: "Agreed to release the player" },
      { party: "Player", name: fullName(p), by: playerAccount?.email ?? null, at: r.player_answered_at, what: "Accepted the move" },
      { party: "Federation", name: "Rugby League Federation Ghana", by: emailOf(r.reviewed_by), at: r.status === "approved" ? r.reviewed_at : null, what: "Approved and registered the move" },
    ],
    qr,
    verifyUrl,
  };
  // The General Manager's signature in the federation's box, once approved.
  const sig = r.status === "approved" ? await getSignatory() : null;
  data.federationSignature = sig ? { img: sig.url, name: sig.name, title: sig.title } : null;
  return { data, raw: r };
}
