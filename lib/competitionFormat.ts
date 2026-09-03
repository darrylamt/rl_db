/**
 * What was actually played, and who played it — read off the competition
 * itself, so every page that scopes matches by either agrees.
 *
 * Format and division are different games rather than different leagues: a
 * 9s try and a 13s try are not the same feat, eRugby is not played on a
 * field, and the women's and youth games have only been recorded since 2024
 * — so a combined figure is quietly a men's 13s figure wearing a hat.
 * Combined stays the default everywhere this is used; anyone who wants one
 * slice alone can ask for it.
 */

export type FormatOption = { key: string; label: string };

const FORMATS: { key: string; label: string; match: RegExp }[] = [
  { key: "13s", label: "13s", match: /\b13s\b/i },
  { key: "9s", label: "9s", match: /\b9s\b/i },
  { key: "erugby", label: "eRugby", match: /e-?rugby/i },
  { key: "beach", label: "Beach", match: /beach/i },
  { key: "presidents", label: "President's Cup", match: /president/i },
  { key: "origins", label: "Origins Cup", match: /origins/i },
];

export function formatOf(name: string | null | undefined): string | null {
  if (!name) return null;
  return FORMATS.find((f) => f.match.test(name))?.key ?? null;
}

export function formatLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return FORMATS.find((f) => f.key === key)?.label ?? null;
}

export const DIVISIONS: FormatOption[] = [
  { key: "men", label: "Men" },
  { key: "women", label: "Women" },
  { key: "youth", label: "Youth" },
];

export function divisionLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return DIVISIONS.find((d) => d.key === key)?.label ?? null;
}

/**
 * Only the formats/divisions actually present in a set of competitions —
 * never offer a filter that leads to an empty page. Pass only competitions
 * that were actually played; an entered-but-unplayed one is not worth a chip.
 */
export function formatsIn(
  competitions: { name?: string | null }[]
): FormatOption[] {
  const seen = new Set(
    competitions.map((c) => formatOf(c.name)).filter(Boolean) as string[]
  );
  return FORMATS.filter((f) => seen.has(f.key)).map((f) => ({
    key: f.key,
    label: f.label,
  }));
}

export function divisionsIn(
  competitions: { division?: string | null }[]
): FormatOption[] {
  const seen = new Set(
    competitions.map((c) => c.division).filter(Boolean) as string[]
  );
  return DIVISIONS.filter((d) => seen.has(d.key));
}
