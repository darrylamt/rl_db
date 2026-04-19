import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

function loadEnv() {
  const p = path.resolve(".env.local");
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}
loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: teams } = await supabase
  .from("teams")
  .select("team_id, name, region, city")
  .order("name");

console.log(`Teams (${teams.length}):\n`);

const rows = [];
for (const t of teams) {
  const [{ count: players }, { count: homeFix }, { count: awayFix }] =
    await Promise.all([
      supabase
        .from("players")
        .select("*", { count: "exact", head: true })
        .eq("team_id", t.team_id),
      supabase
        .from("fixtures")
        .select("*", { count: "exact", head: true })
        .eq("home_team_id", t.team_id),
      supabase
        .from("fixtures")
        .select("*", { count: "exact", head: true })
        .eq("away_team_id", t.team_id),
    ]);
  rows.push({
    name: t.name,
    region: t.region ?? "—",
    players: players ?? 0,
    fixtures: (homeFix ?? 0) + (awayFix ?? 0),
    team_id: t.team_id,
  });
}

rows.sort((a, b) => b.fixtures - a.fixtures || b.players - a.players);

console.log(
  "Name".padEnd(28) +
    "Region".padEnd(20) +
    "Players".padStart(8) +
    "  Fixtures"
);
console.log("-".repeat(68));
for (const r of rows) {
  console.log(
    r.name.padEnd(28) +
      r.region.padEnd(20) +
      String(r.players).padStart(8) +
      "  " +
      String(r.fixtures).padStart(8)
  );
}
