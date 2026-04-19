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

const { data: results, error } = await supabase
  .from("match_results")
  .select("result_id, home_score, away_score, recorded_at, fixture:fixture_id(scheduled_date, home:home_team_id(name), away:away_team_id(name))")
  .order("recorded_at", { ascending: false })
  .limit(10);

if (error) { console.error(error); process.exit(1); }
console.log("Latest 10 results:");
for (const r of results) {
  console.log(`  ${r.fixture?.home?.name ?? "?"} ${r.home_score}-${r.away_score} ${r.fixture?.away?.name ?? "?"}  (${r.fixture?.scheduled_date})`);
}

const { count: zeroZero } = await supabase
  .from("match_results")
  .select("*", { count: "exact", head: true })
  .eq("home_score", 0)
  .eq("away_score", 0);
console.log(`\n0-0 scores: ${zeroZero}/198`);
