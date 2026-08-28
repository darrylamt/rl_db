// Manually-scouted player attributes, 0–100 each. Order defines the radar
// chart axes clockwise from the top — see supabase/player_attributes.sql.

export const PLAYER_ATTRIBUTES = [
  { key: "attr_strength", label: "Strength" },
  { key: "attr_speed", label: "Speed" },
  { key: "attr_iq", label: "IQ" },
  { key: "attr_defense", label: "Defense" },
  { key: "attr_ability", label: "Ability" },
] as const;

export const ATTRIBUTE_AXES = PLAYER_ATTRIBUTES.map((a) => a.label);

/** Attribute values in axis order; null for anything not yet rated. */
export function attributeValues(player: any): (number | null)[] {
  return PLAYER_ATTRIBUTES.map((a) => {
    const v = player?.[a.key];
    return v === null || v === undefined ? null : Number(v);
  });
}

/** True when at least one attribute has been entered. */
export function hasAttributes(player: any): boolean {
  return attributeValues(player).some((v) => v !== null);
}

/** Mean of the entered attributes — an "overall" number. Null when unrated. */
export function attributeAverage(player: any): number | null {
  const vals = attributeValues(player).filter(
    (v): v is number => v !== null && Number.isFinite(v)
  );
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}
