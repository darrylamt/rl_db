// Import RLFG cleaned results xlsx into Supabase.
// Run:  node scripts/import-results.mjs
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// ---- load env ---------------------------------------------------------------
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---- data -------------------------------------------------------------------
const XLSX_PATH = process.argv[2] || "C:/Users/Darryl Amoatey/Downloads/RL Data/RLFG Results Data - Cleaned Data (1).xlsx";
console.log(`Reading ${XLSX_PATH} …`);
const workbook = XLSX.readFile(XLSX_PATH);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets["results"], { defval: null });
const logoRows = XLSX.utils.sheet_to_json(workbook.Sheets["team_logo_paths"], { defval: null });
console.log(`${rows.length} result rows, ${logoRows.length} team-logo rows`);

// ---- helpers ----------------------------------------------------------------
const clean = (s) => (typeof s === "string" ? s.trim() : s);
const titleCase = (s) =>
  !s ? s : s.toLowerCase().replace(/\b([a-z])/g, (_, c) => c.toUpperCase());

function parseDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === "number") {
    // Excel serial
    const base = new Date(Date.UTC(1899, 11, 30));
    const ms = d * 86400 * 1000;
    return new Date(base.getTime() + ms).toISOString().slice(0, 10);
  }
  const s = String(d).trim();
  // e.g. "28th January, 2024"
  const m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s*(\d{4})/);
  if (m) {
    const day = m[1].padStart(2, "0");
    const month = new Date(`${m[2]} 1, 2000`).getMonth();
    if (isNaN(month)) return null;
    const mm = String(month + 1).padStart(2, "0");
    return `${m[3]}-${mm}-${day}`;
  }
  const t = Date.parse(s);
  if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

// Parse "Name (12, 44), Other Name (5)" → [{name, minute}]
function parseScorers(text) {
  if (!text || typeof text !== "string") return [];
  const out = [];
  // Split by "), " to separate scorers
  const parts = text.split(/\)\s*,\s*(?=[A-Za-zÀ-ÿ])/);
  for (let part of parts) {
    part = part.trim();
    if (!part) continue;
    if (!part.endsWith(")")) part += ")";
    const m = part.match(/^(.+?)\s*\(([^)]*)\)\s*$/);
    if (!m) {
      // no minutes, just a name
      if (part) out.push({ name: part.replace(/\)$/, "").trim(), minute: null });
      continue;
    }
    const name = m[1].trim();
    const mins = m[2]
      .split(/[,\s]+/)
      .map((x) => parseInt(x, 10))
      .filter((n) => !isNaN(n));
    if (mins.length === 0) out.push({ name, minute: null });
    for (const minute of mins) out.push({ name, minute });
  }
  return out;
}

// Split roster text into player names
function parseRoster(text) {
  if (!text || typeof text !== "string") return [];
  return text
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length > 1);
}

function splitName(full) {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first_name: parts[0], last_name: "" };
  const last = parts.pop();
  return { first_name: parts.join(" "), last_name: last };
}

// ---- pre-scan: collect unique entities --------------------------------------
const teams = new Map(); // name → {name, logo_url}
const venues = new Map(); // name → {name}
const comps = new Map(); // `${name}|${season}` → {name, season, type, status}
const players = new Map(); // `team|fullname` → {team, first, last}

for (const l of logoRows) {
  const t = clean(l.Team);
  if (t) teams.set(t, { name: t, logo_url: clean(l.Path) ?? null });
}

for (const r of rows) {
  const home = clean(r["Home Team"]);
  const away = clean(r["Away Team"]);
  const venue = clean(r.Venue);
  const comp = clean(r.Competition);
  const year = r.Year ?? r.Season;
  if (home) teams.set(home, teams.get(home) ?? { name: home, logo_url: null });
  if (away) teams.set(away, teams.get(away) ?? { name: away, logo_url: null });
  if (venue) venues.set(venue, { name: venue });
  if (comp && year) {
    const key = `${comp}|${year}`;
    if (!comps.has(key)) {
      comps.set(key, {
        name: comp,
        season: String(year),
        type: comp.toLowerCase().includes("championship") ? "League" : null,
        status: "completed",
      });
    }
  }

  for (const { team, roster } of [
    { team: home, roster: r["Home Roaster"] },
    { team: away, roster: r["Away Roaster"] },
  ]) {
    if (!team) continue;
    for (const name of parseRoster(roster)) {
      const key = `${team}|${name}`;
      if (!players.has(key)) players.set(key, { team, name });
    }
  }
}
console.log(`Unique: ${teams.size} teams · ${venues.size} venues · ${comps.size} competitions · ${players.size} players`);

// ---- upserts ----------------------------------------------------------------
async function upsertMany(table, rows, onConflict) {
  if (rows.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i + 500));
  let all = [];
  for (const c of chunks) {
    const { data, error } = await supabase
      .from(table)
      .upsert(c, { onConflict })
      .select();
    if (error) throw new Error(`${table} upsert: ${error.message}`);
    all = all.concat(data ?? []);
  }
  return all;
}

// Because schema uses uuid PKs with no natural-key uniqueness, we do existence-then-insert per entity.
async function ensureTeam(name, logo_url) {
  const { data: ex } = await supabase.from("teams").select("team_id, logo_url").eq("name", name).maybeSingle();
  if (ex) {
    if (logo_url && ex.logo_url !== logo_url) {
      await supabase.from("teams").update({ logo_url }).eq("team_id", ex.team_id);
    }
    return ex.team_id;
  }
  const { data, error } = await supabase.from("teams").insert({ name, logo_url }).select("team_id").single();
  if (error) throw error;
  return data.team_id;
}
async function ensureVenue(name) {
  const { data: ex } = await supabase.from("venues").select("venue_id").eq("name", name).maybeSingle();
  if (ex) return ex.venue_id;
  const { data, error } = await supabase.from("venues").insert({ name }).select("venue_id").single();
  if (error) throw error;
  return data.venue_id;
}
async function ensureCompetition(name, season, type, status) {
  const { data: ex } = await supabase
    .from("competitions")
    .select("competition_id")
    .eq("name", name)
    .eq("season", season)
    .maybeSingle();
  if (ex) return ex.competition_id;
  const { data, error } = await supabase
    .from("competitions")
    .insert({ name, season, type, status })
    .select("competition_id")
    .single();
  if (error) throw error;
  return data.competition_id;
}
async function ensurePlayer(team_id, fullName) {
  const { first_name, last_name } = splitName(fullName);
  const { data: ex } = await supabase
    .from("players")
    .select("player_id")
    .eq("team_id", team_id)
    .eq("first_name", first_name)
    .eq("last_name", last_name)
    .maybeSingle();
  if (ex) return ex.player_id;
  const { data, error } = await supabase
    .from("players")
    .insert({ team_id, first_name, last_name, playing_status: "active" })
    .select("player_id")
    .single();
  if (error) throw error;
  return data.player_id;
}

// ---- run --------------------------------------------------------------------
const teamIds = new Map();
const venueIds = new Map();
const compIds = new Map();

console.log("→ teams");
for (const t of teams.values()) teamIds.set(t.name, await ensureTeam(t.name, t.logo_url));
console.log("→ venues");
for (const v of venues.values()) venueIds.set(v.name, await ensureVenue(v.name));
console.log("→ competitions");
for (const c of comps.values()) compIds.set(`${c.name}|${c.season}`, await ensureCompetition(c.name, c.season, c.type, c.status));

console.log("→ players (this can take a minute)");
const playerIds = new Map(); // `teamName|fullname` → player_id
let i = 0;
for (const p of players.values()) {
  const tid = teamIds.get(p.team);
  if (!tid) continue;
  playerIds.set(`${p.team}|${p.name}`, await ensurePlayer(tid, p.name));
  i++;
  if (i % 50 === 0) console.log(`   ${i}/${players.size}`);
}
console.log(`   done ${i}`);

console.log("→ fixtures + results + events");
let fx = 0, re = 0, ev = 0;
for (const r of rows) {
  const comp = clean(r.Competition);
  const year = r.Year ?? r.Season;
  const home = clean(r["Home Team"]);
  const away = clean(r["Away Team"]);
  if (!home || !away) continue;

  const date = parseDate(r.Date);
  const venue = clean(r.Venue);

  const home_team_id = teamIds.get(home);
  const away_team_id = teamIds.get(away);
  const venue_id = venue ? venueIds.get(venue) : null;
  const competition_id = comp && year ? compIds.get(`${comp}|${year}`) : null;
  if (!home_team_id || !away_team_id) continue;

  // Determine status from scores
  const rawH = r["Home Team Score"];
  const rawA = r["Away Team Score"];
  const played = !((rawH === null || rawH === undefined || rawH === "") &&
                   (rawA === null || rawA === undefined || rawA === ""));
  const fixtureStatus = played ? "completed" : "scheduled";

  // Fixture: dedupe on (competition, date, home, away)
  let fixture_id;
  {
    const q = supabase
      .from("fixtures")
      .select("fixture_id")
      .eq("home_team_id", home_team_id)
      .eq("away_team_id", away_team_id);
    if (competition_id) q.eq("competition_id", competition_id);
    if (date) q.eq("scheduled_date", date);
    const { data: ex } = await q.maybeSingle();
    if (ex) {
      fixture_id = ex.fixture_id;
      await supabase.from("fixtures").update({ status: fixtureStatus }).eq("fixture_id", fixture_id);
    } else {
      const { data, error } = await supabase
        .from("fixtures")
        .insert({
          competition_id,
          home_team_id,
          away_team_id,
          venue_id: venue_id ?? null,
          scheduled_date: date,
          status: fixtureStatus,
        })
        .select("fixture_id")
        .single();
      if (error) { console.error("fixture insert", error.message); continue; }
      fixture_id = data.fixture_id;
      fx++;
    }
  }

  // Result — skip if this is an unplayed fixture (scores absent)
  const rawHome = r["Home Team Score"];
  const rawAway = r["Away Team Score"];
  const isUnplayed = (rawHome === null || rawHome === undefined || rawHome === "") &&
                     (rawAway === null || rawAway === undefined || rawAway === "");

  if (isUnplayed) {
    // Make sure no stray 0-0 result exists and fixture status is scheduled
    await supabase.from("match_results").delete().eq("fixture_id", fixture_id);
    await supabase.from("fixtures").update({ status: "scheduled" }).eq("fixture_id", fixture_id);
    await supabase.from("match_events").delete().eq("fixture_id", fixture_id);
    continue;
  }

  const home_score = Number(rawHome) || 0;
  const away_score = Number(rawAway) || 0;
  const tries4 = parseScorers(r["Tries 4pts"]);
  const tries5 = parseScorers(r["Tries 5pts"]);
  const convs = parseScorers(r["Conversions"]);
  const missedConvs = parseScorers(r["Missed Conversions"]);

  const homeTries = [...tries4, ...tries5].filter((t) => playerIds.has(`${home}|${t.name}`)).length;
  const awayTries = [...tries4, ...tries5].filter((t) => playerIds.has(`${away}|${t.name}`)).length;
  const homeConv = convs.filter((t) => playerIds.has(`${home}|${t.name}`)).length;
  const awayConv = convs.filter((t) => playerIds.has(`${away}|${t.name}`)).length;

  const { error: resErr } = await supabase.from("match_results").upsert({
    fixture_id,
    home_score,
    away_score,
    home_tries: homeTries,
    away_tries: awayTries,
    home_conversions: homeConv,
    away_conversions: awayConv,
    notes: [r["Match Sheet"], r["Youtube link"]].filter(Boolean).join(" | ") || null,
  }, { onConflict: "fixture_id" });
  if (resErr) { console.error("result", resErr.message); } else { re++; }

  // Match events (tries + conversions) — delete existing for fixture, re-insert
  await supabase.from("match_events").delete().eq("fixture_id", fixture_id);
  const events = [];
  for (const t of tries4) {
    const ph = playerIds.get(`${home}|${t.name}`);
    const pa = playerIds.get(`${away}|${t.name}`);
    if (ph) events.push({ fixture_id, player_id: ph, team_id: home_team_id, event_type: "try", minute: t.minute, notes: "4pt try" });
    else if (pa) events.push({ fixture_id, player_id: pa, team_id: away_team_id, event_type: "try", minute: t.minute, notes: "4pt try" });
  }
  for (const t of tries5) {
    const ph = playerIds.get(`${home}|${t.name}`);
    const pa = playerIds.get(`${away}|${t.name}`);
    if (ph) events.push({ fixture_id, player_id: ph, team_id: home_team_id, event_type: "try", minute: t.minute, notes: "5pt try" });
    else if (pa) events.push({ fixture_id, player_id: pa, team_id: away_team_id, event_type: "try", minute: t.minute, notes: "5pt try" });
  }
  for (const c of convs) {
    const ph = playerIds.get(`${home}|${c.name}`);
    const pa = playerIds.get(`${away}|${c.name}`);
    if (ph) events.push({ fixture_id, player_id: ph, team_id: home_team_id, event_type: "conversion", minute: c.minute });
    else if (pa) events.push({ fixture_id, player_id: pa, team_id: away_team_id, event_type: "conversion", minute: c.minute });
  }
  for (const c of missedConvs) {
    const ph = playerIds.get(`${home}|${c.name}`);
    const pa = playerIds.get(`${away}|${c.name}`);
    if (ph) events.push({ fixture_id, player_id: ph, team_id: home_team_id, event_type: "missed_conversion", minute: c.minute });
    else if (pa) events.push({ fixture_id, player_id: pa, team_id: away_team_id, event_type: "missed_conversion", minute: c.minute });
  }
  if (events.length) {
    const { error: evErr } = await supabase.from("match_events").insert(events);
    if (evErr) console.error("events", evErr.message);
    else ev += events.length;
  }
}

console.log(`\n✓ import done — fixtures:${fx} results:${re} events:${ev}`);
