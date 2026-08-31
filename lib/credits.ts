import { createAdminClient } from "@/lib/supabase/server";

export type CreditRule = {
  code: string;
  area: string;
  label: string;
  amount: number;
  automatic: boolean;
  requires_review: boolean;
  season_cap: number | null;
  active: boolean;
  sort_order: number;
};

export type CreditEntry = {
  entry_id: string;
  team_id: string;
  season: string;
  code: string | null;
  amount: number;
  description: string;
  fixture_id: string | null;
  automatic: boolean;
  shadow: boolean;
  expires_on: string | null;
  created_at: string;
  note: string | null;
};

export type Wallet = {
  /** What the club can actually use — live entries that have not expired. */
  available: number;
  /** Everything on record, rehearsal included. What the club sees as its story. */
  total: number;
  earned: number;
  deducted: number;
  /** Counted and shown, redeemable for nothing. */
  shadow: number;
  expired: number;
  entries: CreditEntry[];
};

export const currentSeason = () => String(new Date().getFullYear());

/** Is this season being rehearsed, or does it count? */
export async function creditsAreLive(season: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("credit_settings")
    .select("live_from_season")
    .maybeSingle();
  const from = (data as any)?.live_from_season ?? "2027";
  return season >= from;
}

/**
 * A club's wallet.
 *
 * The balance is worked out from the rows every time rather than kept
 * anywhere. It costs a sum over a few hundred rows and it cannot drift out of
 * step with the entries a club is being shown, which is the whole point of a
 * ledger.
 */
export async function getWallet(
  teamId: string,
  season?: string
): Promise<Wallet> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("club_credits")
    .select(
      "entry_id, team_id, season, code, amount, description, fixture_id, automatic, shadow, expires_on, created_at, note"
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (season) query = query.eq("season", season);

  const { data } = await query;
  const entries = (data ?? []) as CreditEntry[];

  let available = 0;
  let total = 0;
  let earned = 0;
  let deducted = 0;
  let shadow = 0;
  let expired = 0;

  for (const e of entries) {
    total += e.amount;
    if (e.amount >= 0) earned += e.amount;
    else deducted += e.amount;

    if (e.shadow) {
      shadow += e.amount;
      continue;
    }
    if (e.expires_on && e.expires_on < today) {
      expired += e.amount;
      continue;
    }
    available += e.amount;
  }

  return { available, total, earned, deducted, shadow, expired, entries };
}

export async function getRules(): Promise<CreditRule[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("credit_rules")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  return (data ?? []) as CreditRule[];
}

/**
 * Writes one entry, unless the same thing has already been recorded.
 *
 * dedupe_key is what makes the sweep safe to run as often as anyone likes:
 * the unique index refuses a second row for the same club and the same
 * reason, so a rerun adds only what is new.
 */
export async function award(entry: {
  teamId: string;
  season: string;
  code: string;
  amount: number;
  description: string;
  fixtureId?: string | null;
  playerId?: string | null;
  note?: string | null;
  awardedBy?: string | null;
  automatic?: boolean;
  dedupeKey?: string | null;
}): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const supabase = createAdminClient();
  const live = await creditsAreLive(entry.season);

  const { data: settings } = await supabase
    .from("credit_settings")
    .select("expiry_seasons")
    .maybeSingle();
  const years = (settings as any)?.expiry_seasons ?? 2;

  // Credit lives to the end of the season it was earned in, plus the run-off.
  const expires = `${Number(entry.season) + years}-12-31`;

  const { error } = await supabase.from("club_credits").insert({
    team_id: entry.teamId,
    season: entry.season,
    code: entry.code,
    amount: entry.amount,
    description: entry.description,
    fixture_id: entry.fixtureId ?? null,
    player_id: entry.playerId ?? null,
    note: entry.note ?? null,
    awarded_by: entry.awardedBy ?? null,
    automatic: entry.automatic ?? false,
    shadow: !live,
    expires_on: entry.amount >= 0 ? expires : null,
    dedupe_key: entry.dedupeKey ?? null,
  });

  if (error) {
    // 23505 is the unique index doing its job: already recorded.
    if ((error as any).code === "23505") return { ok: true, duplicate: true };
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
