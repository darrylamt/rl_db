export type Contract = {
  contract_id: string;
  player_id: string;
  team_id: string;
  starts_on: string;
  ends_on: string;
  status: "offered" | "accepted" | "declined" | "withdrawn" | "terminated";
  terms: string | null;
  decline_note: string | null;
  offered_at: string;
  answered_at: string | null;
};

export const MIN_MONTHS = 6;
export const MAX_MONTHS = 24;

/** Months between two dates, rounded down — how a contract length is spoken of. */
export function monthsBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  let months =
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  return months;
}

/** "2 years", "1 year 3 months", "8 months" — never "1.25 years". */
export function describeLength(months: number): string {
  if (months <= 0) return "expired";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} year${years === 1 ? "" : "s"}`);
  if (rest) parts.push(`${rest} month${rest === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/**
 * What is left to run on a contract, from today.
 *
 * Returns null when there is nothing live — which is the answer a transfer
 * list wants as much as a number is: a player with no contract is a
 * different proposition from one with two years left.
 */
export function remaining(contract: Contract | null | undefined): {
  months: number;
  label: string;
  endsOn: string;
} | null {
  if (!contract || contract.status !== "accepted") return null;
  const today = new Date().toISOString().slice(0, 10);
  if (contract.ends_on < today) return null;
  const months = monthsBetween(today, contract.ends_on);
  return {
    months,
    label: months <= 0 ? "under a month" : describeLength(months),
    endsOn: contract.ends_on,
  };
}

/** Whether a proposed length is inside the six-month to two-year rule. */
export function lengthProblem(starts: string, ends: string): string | null {
  if (!starts || !ends) return "A contract needs a start and an end.";
  if (ends <= starts) return "A contract has to end after it starts.";
  const months = monthsBetween(starts, ends);
  if (months < MIN_MONTHS) {
    return `The shortest contract is ${MIN_MONTHS} months. That one is ${describeLength(months) || "under a month"}.`;
  }
  if (months > MAX_MONTHS) {
    return `The longest contract is 2 years. That one is ${describeLength(months)}.`;
  }
  return null;
}

/** The live contract from a set, if there is one. */
export function liveContract(list: Contract[] | null | undefined): Contract | null {
  const today = new Date().toISOString().slice(0, 10);
  return (
    (list ?? []).find((c) => c.status === "accepted" && c.ends_on >= today) ?? null
  );
}

/** Contracts inside the warning window, soonest first. */
export const EXPIRY_WARNING_DAYS = 31;

export function expiringSoon<T extends { ends_on: string; status: string }>(
  list: T[] | null | undefined
): T[] {
  const today = new Date();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + EXPIRY_WARNING_DAYS);

  const from = today.toISOString().slice(0, 10);
  const to = limit.toISOString().slice(0, 10);

  return (list ?? [])
    .filter((c) => c.status === "accepted" && c.ends_on >= from && c.ends_on <= to)
    .sort((a, b) => a.ends_on.localeCompare(b.ends_on));
}

/** "in 12 days", "tomorrow", "today" — a month out, days read better than months. */
export function daysUntil(date: string): number {
  const a = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  const b = new Date(`${date}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function describeDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/**
 * How close to the end a contract has to be before it can be re-signed.
 *
 * The same month the club is warned about, so the warning and the thing it
 * asks you to do arrive together rather than the second lagging the first.
 */
export const RENEWAL_WINDOW_DAYS = EXPIRY_WARNING_DAYS;

/**
 * Whether a club may offer this player new terms, and why not when it may not.
 *
 * A club can always sign somebody it has nothing running with. Re-signing
 * its own player is allowed only in the last month — early enough to keep
 * them, late enough that a club cannot lock somebody in for years by
 * re-signing them every week.
 */
export function renewalProblem(
  current: { ends_on: string; status: string } | null | undefined,
  proposedStart: string
): string | null {
  if (!current || current.status !== "accepted") return null;

  const today = new Date().toISOString().slice(0, 10);
  if (current.ends_on < today) return null;

  const days = daysUntil(current.ends_on);
  if (days > RENEWAL_WINDOW_DAYS) {
    return `Their contract runs to ${current.ends_on}. You can offer new terms once it is inside its last month — that is ${describeDays(days - RENEWAL_WINDOW_DAYS)}.`;
  }

  // A renewal follows the contract it renews; it does not sit on top of it.
  if (proposedStart <= current.ends_on) {
    return `Their current contract runs to ${current.ends_on}, so new terms have to start after that.`;
  }

  return null;
}
