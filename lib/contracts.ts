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
