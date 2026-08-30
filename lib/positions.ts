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
