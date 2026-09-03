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

export function isPosition(value: unknown): value is Position {
  return (
    typeof value === "string" && (POSITIONS as readonly string[]).includes(value)
  );
}

/**
 * The other positions a player can cover, cleaned up.
 *
 * A player has one main position and may cover others, so the list is only
 * ever the others: anything repeating the main is dropped rather than
 * rejected, because ticking your own main position is a mistake worth
 * absorbing quietly rather than a save worth failing.
 *
 * Order follows POSITIONS so two players who cover the same positions read
 * the same way round.
 */
export function cleanSecondaryPositions(
  values: readonly unknown[] | null | undefined,
  main?: string | null
): string[] {
  const wanted = new Set(
    (values ?? []).filter(isPosition).filter((p) => p !== main)
  );
  return POSITIONS.filter((p) => wanted.has(p));
}

/** Every position a player can be picked in, main first. */
export function allPositions(
  main?: string | null,
  secondary?: readonly string[] | null
): string[] {
  return [
    ...(isPosition(main) ? [main] : []),
    ...cleanSecondaryPositions(secondary, main),
  ];
}

/** Whether a player can be picked in this position at all. */
export function coversPosition(
  position: string,
  main?: string | null,
  secondary?: readonly string[] | null
): boolean {
  return allPositions(main, secondary).includes(position);
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
