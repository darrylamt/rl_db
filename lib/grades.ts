/**
 * Men's, women's and youth.
 *
 * A club fields all three from one team row and one badge — the grade is a
 * property of the player, not of the club — so separating them is a matter
 * of filtering rather than of splitting anything up.
 *
 * A handful of rows carry "Senior Men" and "Male" where the rest use
 * snake_case, so anything comparing these normalises first.
 */
export const GRADES = [
  { value: "senior_men", label: "Men" },
  { value: "senior_women", label: "Women" },
  { value: "youth", label: "Youth" },
] as const;

export type Grade = (typeof GRADES)[number]["value"];

export function normaliseGrade(category: string | null | undefined): string {
  return (category ?? "").toLowerCase().replace(/\s+/g, "_");
}

/** Whether a player's category is the grade being filtered for. */
export function isGrade(
  category: string | null | undefined,
  grade: string | null | undefined
): boolean {
  if (!grade) return true;
  return normaliseGrade(category) === grade;
}

/** "Men" / "Women" / "Youth", or nothing when it is not set. */
export function gradeLabel(category: string | null | undefined): string {
  const g = normaliseGrade(category);
  return GRADES.find((x) => x.value === g)?.label ?? "";
}
