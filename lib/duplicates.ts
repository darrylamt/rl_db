import { createAdminClient } from "@/lib/supabase/server";

/**
 * The same person, on record twice.
 *
 * The federation writes a name more than one way — Emmanuel and Emanuel,
 * Livingston and Livingstone — so a youth player who came up to the senior
 * side often got a second record rather than keeping the first. Their career
 * is then split across two profiles: half the appearances on each, and
 * neither one right.
 *
 * An earlier migration merged the exact matches, on name AND date of birth.
 * That catches an import run twice and nothing else. These are the spelling
 * variants it could not see, which is most of them, because only 186 of 525
 * players have a date of birth at all.
 *
 * NOTHING HERE MERGES ANYTHING. Some of what it turns up is two real people
 * — this register contains a Desmond Okyere Jnr and a Desmond Okyere Snr —
 * so every pair is put to the federation with its evidence and merged only
 * when somebody says so.
 */

export type Candidate = {
  a: PlayerRow;
  b: PlayerRow;
  /** 0–1. How much the evidence says these are one person. */
  confidence: number;
  /** Said plainly, for the page. */
  because: string[];
  /** Why they cannot be, when something rules it out. */
  against: string[];
};

export type PlayerRow = {
  player_id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  team_id: string | null;
  team_name: string | null;
  category: string | null;
  gender: string | null;
  playing_status: string | null;
  appearances: number;
  events: number;
  /** Fixtures they are named in, to spot two records in one match. */
  fixtures: Set<string>;
  /** national or president_xv rather than a club. */
  representative: boolean;
};

const norm = (v: string | null | undefined) =>
  (v ?? "").trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ");

const fullName = (p: PlayerRow) =>
  `${norm(p.first_name)} ${norm(p.last_name)}`.trim();

/** Edit distance, capped — anything past 3 is not a spelling variant. */
function distance(a: string, b: string, cap = 4): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return d[m][n];
}

/** Jnr and Snr are a statement that these are two people, not one. */
const GENERATION = /\b(jnr|jr|snr|sr|junior|senior|ii|iii)\b/;

function generationOf(p: PlayerRow): string | null {
  const m = `${norm(p.first_name)} ${norm(p.last_name)}`.match(GENERATION);
  return m ? m[1] : null;
}

async function pageAll(table: string, columns: string): Promise<any[]> {
  const supabase = createAdminClient();
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

/**
 * Every pair worth a second look, with the case for and against.
 *
 * Two records naming the same person cannot both appear in one match, so a
 * shared fixture is treated as proof they are different people and the pair
 * is dropped. Two different dates of birth do the same.
 */
export async function findDuplicates(): Promise<Candidate[]> {
  const [players, teams, lineups, events] = await Promise.all([
    pageAll(
      "players",
      "player_id, first_name, last_name, date_of_birth, team_id, category, gender, playing_status"
    ),
    pageAll("teams", "team_id, name, team_type"),
    pageAll("match_lineups", "player_id, fixture_id"),
    pageAll("match_events", "player_id, fixture_id"),
  ]);

  const teamName = new Map(teams.map((t: any) => [t.team_id, t.name]));
  // A national side or a President's XIII is not a club somebody transferred
  // to. Being on one is the ordinary reason the same person holds a second
  // record, so it has to count for a pair rather than against it.
  const isRep = new Map(
    teams.map((t: any) => [t.team_id, t.team_type !== "club"])
  );

  const fixturesBy = new Map<string, Set<string>>();
  const eventCount = new Map<string, number>();
  for (const l of lineups) {
    if (!fixturesBy.has(l.player_id)) fixturesBy.set(l.player_id, new Set());
    fixturesBy.get(l.player_id)!.add(l.fixture_id);
  }
  for (const e of events) {
    eventCount.set(e.player_id, (eventCount.get(e.player_id) ?? 0) + 1);
    if (!fixturesBy.has(e.player_id)) fixturesBy.set(e.player_id, new Set());
    fixturesBy.get(e.player_id)!.add(e.fixture_id);
  }

  const rows: PlayerRow[] = players.map((p: any) => ({
    player_id: p.player_id,
    first_name: p.first_name,
    last_name: p.last_name,
    date_of_birth: p.date_of_birth,
    team_id: p.team_id,
    team_name: p.team_id ? (teamName.get(p.team_id) ?? null) : null,
    category: p.category,
    gender: p.gender,
    playing_status: p.playing_status,
    representative: p.team_id ? (isRep.get(p.team_id) ?? false) : false,
    appearances: fixturesBy.get(p.player_id)?.size ?? 0,
    events: eventCount.get(p.player_id) ?? 0,
    fixtures: fixturesBy.get(p.player_id) ?? new Set<string>(),
  }));

  const out: Candidate[] = [];

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];

      const nameA = fullName(a);
      const nameB = fullName(b);
      if (!nameA || !nameB) continue;

      const surnameSame = norm(a.last_name) === norm(b.last_name);
      const d = distance(nameA, nameB);

      // The shapes worth considering at all.
      const sameDob =
        !!a.date_of_birth && a.date_of_birth === b.date_of_birth;
      const nearName = d > 0 && d <= 2;
      // "Wilkins Addy" against "Wilkins Nii Kpani Addy": one name inside the
      // other, which a plain edit distance scores as miles apart.
      const contained =
        surnameSame &&
        norm(a.first_name).split(" ")[0] === norm(b.first_name).split(" ")[0] &&
        nameA !== nameB;

      if (!sameDob && !nearName && !contained) continue;

      const because: string[] = [];
      const against: string[] = [];

      if (sameDob) because.push(`Both born ${a.date_of_birth}`);
      if (nearName) because.push(`Names differ by ${d} letter${d === 1 ? "" : "s"}`);
      if (contained) because.push("One name is the other with more of it");
      if (surnameSame) because.push("Same surname");
      const sameClub = !!a.team_id && a.team_id === b.team_id;
      const clubAndCountry =
        !sameClub && (a.representative !== b.representative);
      if (sameClub) because.push(`Both at ${a.team_name}`);
      if (clubAndCountry) {
        because.push("One is a club record, one a representative side");
      }
      const youthSenior =
        (a.category ?? "").includes("youth") !==
        (b.category ?? "").includes("youth");
      if (youthSenior) because.push("One youth, one senior — the move up");

      // ── What rules it out ──
      let impossible = false;

      const shared = Array.from(a.fixtures).filter((f) => b.fixtures.has(f));
      if (shared.length > 0) {
        against.push(
          `Both named in the same ${shared.length === 1 ? "match" : `${shared.length} matches`} — cannot be one person`
        );
        impossible = true;
      }

      if (
        a.date_of_birth &&
        b.date_of_birth &&
        a.date_of_birth !== b.date_of_birth
      ) {
        against.push("Different dates of birth");
        impossible = true;
      }

      const genA = generationOf(a);
      const genB = generationOf(b);
      if (genA && genB && genA !== genB) {
        against.push(`One is ${genA}, the other ${genB}`);
        impossible = true;
      }

      if (a.gender && b.gender && a.gender !== b.gender) {
        against.push("Recorded as different genders");
        impossible = true;
      }

      if (impossible) continue;

      // ── How sure ──
      let confidence = 0;
      if (sameDob) confidence += 0.5;
      if (d === 1) confidence += 0.35;
      else if (d === 2) confidence += 0.2;
      if (contained) confidence += 0.3;
      if (surnameSame) confidence += 0.15;
      if (sameClub) confidence += 0.15;
      // Picked for Ghana and entered again rather than linked — the second
      // commonest way one person ends up with two records here.
      if (clubAndCountry) confidence += 0.2;
      if (youthSenior) confidence += 0.1;
      confidence = Math.min(1, confidence);

      out.push({ a, b, confidence, because, against });
    }
  }

  return out.sort((x, y) => y.confidence - x.confidence);
}

/** Every table that points at a player, so a merge leaves nothing behind. */
export const PLAYER_REFERENCES = [
  "match_events",
  "match_lineups",
  "match_player_ratings",
  "player_history",
  "player_registrations",
  "suspensions",
  "contracts",
  "player_availability",
  "player_transfer_requests",
  "transfer_requests",
  "player_terms_decisions",
  "app_users",
] as const;
