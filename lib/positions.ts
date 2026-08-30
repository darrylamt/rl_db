// The positions a rugby league side is picked in, and what each one is for.
//
// The grouping is not decoration: an overall rating weighted by position needs
// to know that a prop is judged on different things from a winger. Kept in one
// place so the admin, the club portal and any rating that follows agree.

export const POSITIONS = [
  "Fullback",
  "Wing",
  "Centre",
  "Stand-off",
  "Scrum-half",
  "Prop",
  "Hooker",
  "Second-row",
  "Loose forward",
  "Utility",
] as const;

export type Position = (typeof POSITIONS)[number];

/** Which broad job a position does. Utility belongs to neither. */
export const POSITION_GROUP: Record<string, "back" | "forward" | "utility"> = {
  Fullback: "back",
  Wing: "back",
  Centre: "back",
  "Stand-off": "back",
  "Scrum-half": "back",
  Prop: "forward",
  Hooker: "forward",
  "Second-row": "forward",
  "Loose forward": "forward",
  Utility: "utility",
};

export function positionGroup(position?: string | null) {
  if (!position) return null;
  return POSITION_GROUP[position] ?? null;
}

/**
 * Whether a player belongs in a competition of this division.
 *
 * Six clubs field men's, women's and youth sides from a single team row —
 * the grade is on the player, not the team — so loading a squad by team_id
 * alone hands a men's match every woman and every junior at the club.
 *
 * A handful of rows carry "Senior Men" and "Male" rather than the snake_case
 * the rest use, so the value is normalised before comparing. An unknown
 * division filters nothing: better every name than the wrong ones missing.
 */
export function inDivision(
  category: string | null | undefined,
  division: string | null | undefined
): boolean {
  const c = (category ?? "").toLowerCase().replace(/\s+/g, "_");
  const d = (division ?? "").toLowerCase().trim();

  if (d === "women") return c === "senior_women";
  if (d === "youth") return c === "youth";
  if (d === "men") return c === "senior_men";
  return true;
}
