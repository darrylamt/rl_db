import { createAdminClient } from "@/lib/supabase/server";
import { getClubValues } from "@/lib/clubValue";

/**
 * LeagueX — the federation's currency, and the rules it moves by.
 *
 * The federation does no monetary transfers, so a player's value on its own
 * is a label. A label does not stop seven players leaving a club in a week.
 * A purse does: the club losing them is paid, the clubs taking them are
 * poorer, and the pot everyone is bidding from is finite.
 *
 * Everything here is a plain number with a name, because these are federation
 * policy rather than engineering. Anybody in the room should be able to read
 * this file and say whether they agree with it.
 */

/** The federation's own account, written as a null team_id in the ledger. */
export const FEDERATION = "__federation__";

/** The federation's cut of every deal, paid by the buyer on top of the fee. */
export const LEVY_RATE = 0.1;

/**
 * What a club is granted each season.
 *
 * Deliberately not the club's value. Value measures merit, and paying for
 * merit compounds it — the strongest club would out-buy everyone and get
 * stronger. This measures obligation: what a club has to field, and how long
 * it has been turning up. A club running three grades needs three squads.
 */
export const BASE_ALLOCATION = 3000;
export const PER_EXTRA_GRADE = 1000;
export const PER_SEASON = 250;
export const SEASON_BONUS_CAP = 1500;

/**
 * How much of an allocation may be carried into the next season.
 *
 * Saving for one big signing should work. Banking four quiet seasons and
 * then buying a league should not.
 */
export const CARRY_OVER_SHARE = 0.5;

/** A loan costs half of what buying the player outright would. */
export const LOAN_SHARE = 0.5;

export type LedgerKind =
  | "allocation"
  | "expiry"
  | "fee"
  | "levy"
  | "adjustment";

export type LedgerEntry = {
  entry_id: string;
  team_id: string | null;
  kind: LedgerKind;
  amount: number;
  season: string | null;
  player_id: string | null;
  counterparty_team_id: string | null;
  request_id: string | null;
  note: string | null;
  created_at: string;
};

/** "6,500 LX". The suffix, never a prefix — it is not a dollar. */
export function formatLX(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-GB")} LX`;
}

/** "+120 LX" / "−120 LX", for a ledger where the sign is the point. */
export function formatSigned(amount: number): string {
  const n = Math.round(amount);
  return `${n < 0 ? "−" : "+"}${Math.abs(n).toLocaleString("en-GB")} LX`;
}

/** The season budgets are granted against. */
export function currentSeason(): string {
  return String(new Date().getFullYear());
}

/**
 * What a move costs.
 *
 * The fee goes to the selling club, and the levy is added on top rather than
 * taken out of it. Two reasons: the seller always receives exactly the
 * player's value, which is the sentence everyone can check; and buying costs
 * more than the sticker price, which is the friction that makes raiding a
 * squad expensive.
 */
export function priceFor(
  value: number,
  kind: "transfer" | "loan" = "transfer"
): { fee: number; levy: number; total: number } {
  const fee = Math.round(value * (kind === "loan" ? LOAN_SHARE : 1));
  const levy = Math.round(fee * LEVY_RATE);
  return { fee, levy, total: fee + levy };
}

/** What a club is granted for a season, from what it fields and how long. */
export function allocationFor(grades: number, seasons: number): number {
  const extra = Math.max(0, grades - 1);
  return (
    BASE_ALLOCATION +
    PER_EXTRA_GRADE * extra +
    Math.min(SEASON_BONUS_CAP, PER_SEASON * Math.max(0, seasons))
  );
}

/** The most a club may bring into a season from the last one. */
export function carryOverCap(allocation: number): number {
  return Math.round(allocation * CARRY_OVER_SHARE);
}

export type Books = {
  /** team_id -> balance. Clubs with no entries are absent, not zero-filled. */
  balances: Map<string, number>;
  /** What the levy has brought in. */
  bank: number;
  /** Held by clubs. Bank money has left circulation. */
  circulating: number;
  entries: LedgerEntry[];
  /** True until supabase/club_budgets.sql has been run. */
  notMigrated: boolean;
};

/**
 * Reads the whole ledger and adds it up.
 *
 * Every balance in the system is derived here rather than stored, for the
 * same reason totals are derived everywhere else: a stored balance is wrong
 * the moment an entry is corrected, and nobody notices for a season.
 *
 * PostgREST caps a request at a thousand rows whatever you ask for, so this
 * pages. A ledger outgrows a thousand rows sooner than anything else here.
 */
export async function getBooks(): Promise<Books> {
  const supabase = createAdminClient();
  const entries: LedgerEntry[] = [];
  let notMigrated = false;

  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("lx_ledger")
      .select(
        "entry_id, team_id, kind, amount, season, player_id, counterparty_team_id, request_id, note, created_at"
      )
      .order("created_at", { ascending: false })
      .range(from, from + 999);

    if (error) {
      // 42P01 is "relation does not exist" — the migration is not run yet,
      // and every page reading this should show empty books, not an error.
      if ((error as any).code === "42P01") notMigrated = true;
      break;
    }
    if (!data) break;
    entries.push(...(data as LedgerEntry[]));
    if (data.length < 1000) break;
  }

  const balances = new Map<string, number>();
  let bank = 0;
  for (const e of entries) {
    if (e.team_id === null) {
      bank += e.amount;
      continue;
    }
    balances.set(e.team_id, (balances.get(e.team_id) ?? 0) + e.amount);
  }

  let circulating = 0;
  for (const v of Array.from(balances.values())) circulating += v;

  return { balances, bank, circulating, entries, notMigrated };
}

/** One club's balance, for the pages that only need the one. */
export async function getBalance(teamId: string): Promise<number | null> {
  const { balances, notMigrated } = await getBooks();
  if (notMigrated) return null;
  return balances.get(teamId) ?? 0;
}

export type ClubBudget = {
  teamId: string;
  name: string;
  balance: number;
  /** What this season's grant would be, whether or not it has been made. */
  allocation: number;
  grades: number;
  seasons: number;
  granted: boolean;
};

/**
 * Every club's purse, alongside what it is owed this season.
 *
 * Grades and seasons come from the club valuation, which reads them from
 * fixtures actually entered rather than names on a register — a club with
 * juniors on paper that never enters a youth competition is not running a
 * youth setup, and should not be funded for one.
 */
export async function getClubBudgets(
  season = currentSeason()
): Promise<{ budgets: ClubBudget[]; books: Books }> {
  const [books, clubs] = await Promise.all([getBooks(), getClubValues()]);

  const grantedThisSeason = new Set(
    books.entries
      .filter((e) => e.kind === "allocation" && e.season === season && e.team_id)
      .map((e) => e.team_id as string)
  );

  const budgets = clubs.map((c) => ({
    teamId: c.teamId,
    name: c.name,
    balance: books.balances.get(c.teamId) ?? 0,
    allocation: allocationFor(c.gradesFielded.length, c.seasons),
    grades: c.gradesFielded.length,
    seasons: c.seasons,
    granted: grantedThisSeason.has(c.teamId),
  }));

  budgets.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  return { budgets, books };
}
