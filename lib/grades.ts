/**
 * Men's, women's, youth boys' and youth girls'.
 *
 * A club fields all of these from one team row and one badge — the grade is a
 * property of the player, not of the club — so separating them is a matter of
 * filtering rather than of splitting anything up.
 *
 * Youth used to be one grade. It is two, because a club running a girls youth
 * setup is running female rugby and the old model could not see it: Skolars
 * entered thirteen youth girls' fixtures in 2025 and were still marked down
 * for having no women's side.
 *
 * A player's grade comes from category and gender together rather than from a
 * column of its own. All 264 youth players already have a gender recorded, so
 * there is nothing to migrate and nothing for anybody to re-enter.
 *
 * A handful of rows carry "Senior Men" and "Male" where the rest use
 * snake_case, so anything comparing these normalises first.
 */

export const GRADES = [
  { value: "senior_men", label: "Men" },
  { value: "senior_women", label: "Women" },
  { value: "youth_boys", label: "Youth Boys" },
  { value: "youth_girls", label: "Youth Girls" },
] as const;

export type Grade = (typeof GRADES)[number]["value"];

/** Youth with no gender said. Counts as youth, and as neither boys nor girls. */
export const YOUTH_UNSPECIFIED = "youth";

export function normaliseGrade(category: string | null | undefined): string {
  return (category ?? "").toLowerCase().replace(/\s+/g, "_");
}

function isFemale(gender: string | null | undefined): boolean {
  return (gender ?? "").trim().toLowerCase().startsWith("f");
}

function isMale(gender: string | null | undefined): boolean {
  return (gender ?? "").trim().toLowerCase().startsWith("m");
}

/**
 * The grade a player actually belongs to.
 *
 * Youth splits on the gender already on the player. A youth player with no
 * gender recorded stays plain "youth" rather than being guessed at — it counts
 * towards a youth setup and towards neither a boys' nor a girls' one, which is
 * the reading that cannot hand out credit nobody earned.
 */
export function effectiveGrade(
  category: string | null | undefined,
  gender?: string | null
): string {
  const c = normaliseGrade(category);

  if (c === "senior_men" || c === "male" || c === "men") return "senior_men";
  if (c === "senior_women" || c === "female" || c === "women") {
    return "senior_women";
  }

  if (c === "youth" || c === "youth_boys" || c === "youth_girls") {
    if (c === "youth_boys" || c === "youth_girls") return c;
    if (isFemale(gender)) return "youth_girls";
    if (isMale(gender)) return "youth_boys";
    return YOUTH_UNSPECIFIED;
  }

  return "unknown";
}

/** A competition or team division, in the same words a player's grade uses. */
export function gradeOfDivision(division: string | null | undefined): string {
  const d = (division ?? "men").toLowerCase().replace(/\s+/g, "_");
  if (d === "women") return "senior_women";
  if (d === "youth_girls") return "youth_girls";
  if (d === "youth_boys") return "youth_boys";
  if (d === "youth") return YOUTH_UNSPECIFIED;
  return "senior_men";
}

/** Whether a player's category is the grade being filtered for. */
export function isGrade(
  category: string | null | undefined,
  grade: string | null | undefined,
  gender?: string | null
): boolean {
  if (!grade) return true;
  const actual = effectiveGrade(category, gender);
  // Asking for "youth" means either kind of youth, plus the ones nobody has
  // said. Asking for one of the two means only that one.
  if (grade === YOUTH_UNSPECIFIED) return isYouth(actual);
  return actual === grade;
}

/** True for boys, girls, and youth nobody has classified. */
export function isYouth(grade: string | null | undefined): boolean {
  return (
    grade === "youth_boys" || grade === "youth_girls" || grade === YOUTH_UNSPECIFIED
  );
}

/**
 * True for the grades that make up female rugby.
 *
 * This is the rule the federation asked for: a girls youth setup is female
 * rugby, so a club running one is not treated as having no women's side.
 */
export function isFemaleGrade(grade: string | null | undefined): boolean {
  return grade === "senior_women" || grade === "youth_girls";
}

/** True for the grades that make up male rugby. */
export function isMaleGrade(grade: string | null | undefined): boolean {
  return grade === "senior_men" || grade === "youth_boys";
}

/** "Men" / "Women" / "Youth Boys" / "Youth Girls", or nothing when unset. */
export function gradeLabel(
  category: string | null | undefined,
  gender?: string | null
): string {
  const g = effectiveGrade(category, gender);
  if (g === YOUTH_UNSPECIFIED) return "Youth";
  return GRADES.find((x) => x.value === g)?.label ?? "";
}
