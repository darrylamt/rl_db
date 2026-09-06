import { createAdminClient } from "@/lib/supabase/server";

/**
 * Saying what an audit entry actually means.
 *
 * The trail is written by a database trigger, so it speaks the database's
 * language: "players.update" against a row id, with a detail blob reading
 * {"changed":{"scheduled_time":["09:43:00","14:00:00"]}}. That is precise and
 * close to unreadable — 705 of the 902 entries on record carry no summary at
 * all, so all most of them ever showed was a table name and a verb.
 *
 * Everything here turns that back into a sentence. Nothing is stored: the
 * words are worked out on reading, so correcting one is a deploy rather than
 * a migration, and an entry written last year gets today's wording.
 */

export type AuditEntry = {
  entry_id: string;
  at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  summary: string | null;
  detail: any;
};

export type FieldChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

/** What each table is called when you are talking rather than querying. */
const THINGS: Record<string, { one: string; a: string }> = {
  app_users: { one: "login", a: "a login" },
  players: { one: "player", a: "a player" },
  teams: { one: "club", a: "a club" },
  fixtures: { one: "fixture", a: "a fixture" },
  competitions: { one: "competition", a: "a competition" },
  venues: { one: "venue", a: "a venue" },
  officials: { one: "match official", a: "a match official" },
  fixture_officials: { one: "match appointment", a: "a match appointment" },
  match_events: { one: "match event", a: "a match event" },
  match_results: { one: "result", a: "a result" },
  match_lineups: { one: "team sheet entry", a: "a player on a team sheet" },
  match_player_ratings: { one: "player rating", a: "a player rating" },
  team_sheets: { one: "team sheet", a: "a team sheet" },
  player_registrations: { one: "registration", a: "a registration" },
  player_history: { one: "club history entry", a: "a club history entry" },
  suspensions: { one: "suspension", a: "a suspension" },
  articles: { one: "article", a: "an article" },
  documents: { one: "document", a: "a document" },
  people: { one: "board member", a: "a board member" },
  partners: { one: "partner", a: "a partner" },
  coaches: { one: "coach", a: "a coach" },
  seasons: { one: "season", a: "a season" },
  lx_ledger: { one: "LeagueX entry", a: "a LeagueX entry" },
};

/** Column names, in the words the federation uses for them. */
const FIELDS: Record<string, string> = {
  team_id: "Club",
  position: "Main position",
  secondary_positions: "Other positions covered",
  photo_url: "Photo",
  jersey_number: "Shirt number",
  date_of_birth: "Date of birth",
  playing_status: "Playing status",
  approval_status: "Approval",
  first_name: "First name",
  last_name: "Last name",
  height_cm: "Height",
  weight_kg: "Weight",
  is_captain: "Captain",
  category: "Grade",
  gender: "Gender",
  scheduled_date: "Date",
  scheduled_time: "Kick-off time",
  kickoff_at: "Kick-off",
  clock_state: "Match clock",
  paused_at: "Clock paused at",
  stoppage_seconds: "Stoppage time",
  venue_id: "Venue",
  competition_id: "Competition",
  home_team_id: "Home team",
  away_team_id: "Away team",
  home_score: "Home score",
  away_score: "Away score",
  is_starter: "Starting",
  division: "Division",
  founded_year: "Founded",
  is_public: "Shown publicly",
  coach_name: "Coach",
  manager_name: "Manager",
  home_venue_id: "Home ground",
  head_coach_id: "Head coach",
  assistant_coach_id: "Assistant coach",
  review_note: "Note back",
  status: "Status",
  role: "Role",
  email: "Email",
  phone: "Phone",
  notes: "Notes",
  video_url: "Video",
  event_type: "Event",
  minute: "Minute",
  slug: "Web address",
};

/** Columns nobody needs to see moved: bookkeeping, not decisions. */
const NOISE = new Set([
  "updated_at",
  "created_at",
  "submitted_at",
  "reviewed_at",
  "answered_at",
  "offered_at",
]);

export function fieldLabel(field: string): string {
  return (
    FIELDS[field] ??
    field.replace(/_id$/, "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}

export function thingName(entity: string | null | undefined): string {
  return THINGS[entity ?? ""]?.one ?? (entity ?? "record").replace(/_/g, " ");
}

function looksLikeId(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

/** One value, written the way a person would say it. */
function say(value: unknown, names: Map<string, string>): string {
  if (value === null || value === undefined || value === "") return "nothing";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) {
    return value.length === 0 ? "nothing" : value.join(", ");
  }
  if (looksLikeId(value)) return names.get(value) ?? "another record";
  if (typeof value === "object") return JSON.stringify(value);

  const s = String(value);
  // 2026-08-30T11:18:47.360295+00:00 -> 30 Aug 2026, 11:18
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return s.replace(/_/g, " ");
}

/**
 * Every id mentioned anywhere in the entry, resolved to a name.
 *
 * An audit row is full of uuids — the club a player moved to, the venue a
 * fixture was moved to — and a uuid tells a reader nothing. One lookup per
 * table beats one per id, and anything that cannot be resolved is simply
 * called "another record" rather than shown raw.
 */
export async function resolveNames(
  entries: AuditEntry[]
): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const ids = new Set<string>();

  const collect = (v: unknown) => {
    if (looksLikeId(v)) ids.add(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object") Object.values(v).forEach(collect);
  };
  for (const e of entries) {
    if (e.entity_id) ids.add(e.entity_id);
    collect(e.detail);
  }
  if (ids.size === 0) return new Map();

  const list = Array.from(ids);
  const names = new Map<string, string>();

  const sources: {
    table: string;
    key: string;
    columns: string;
    label: (r: any) => string;
  }[] = [
    {
      table: "players",
      key: "player_id",
      columns: "player_id, first_name, last_name",
      label: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    },
    { table: "teams", key: "team_id", columns: "team_id, name", label: (r) => r.name },
    {
      table: "competitions",
      key: "competition_id",
      columns: "competition_id, name, season",
      label: (r) => [r.name, r.season].filter(Boolean).join(" "),
    },
    { table: "venues", key: "venue_id", columns: "venue_id, name", label: (r) => r.name },
    {
      table: "officials",
      key: "official_id",
      columns: "official_id, first_name, last_name",
      label: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    },
    {
      table: "coaches",
      key: "coach_id",
      columns: "coach_id, first_name, last_name",
      label: (r) => `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
    },
    {
      table: "app_users",
      key: "user_id",
      columns: "user_id, email",
      label: (r) => r.email ?? "an account",
    },
  ];

  await Promise.all(
    sources.map(async (src) => {
      const { data } = await supabase
        .from(src.table)
        .select(src.columns)
        .in(src.key, list);
      for (const row of (data ?? []) as any[]) {
        const label = src.label(row);
        if (label) names.set(row[src.key], label);
      }
    })
  );

  // Fixtures read as "Bulls v Skolars", which needs the teams resolved first.
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("fixture_id, scheduled_date, home_team_id, away_team_id")
    .in("fixture_id", list);
  for (const f of (fixtures ?? []) as any[]) {
    const home = names.get(f.home_team_id) ?? "?";
    const away = names.get(f.away_team_id) ?? "?";
    names.set(
      f.fixture_id,
      `${home} v ${away}${f.scheduled_date ? ` on ${f.scheduled_date}` : ""}`
    );
  }

  return names;
}

/** The fields an update actually moved, in readable form. */
export function changesIn(
  detail: any,
  names: Map<string, string>
): FieldChange[] {
  const changed = detail?.changed;
  if (!changed || typeof changed !== "object") return [];
  return Object.entries(changed)
    .filter(([field]) => !NOISE.has(field))
    .map(([field, pair]) => {
      const [before, after] = Array.isArray(pair) ? pair : [null, pair];
      return {
        field,
        label: fieldLabel(field),
        before: say(before, names),
        after: say(after, names),
      };
    });
}

/** Who did it, said plainly. */
export function whoDidIt(entry: AuditEntry): string {
  if (entry.actor_email) return entry.actor_email;
  if (entry.actor_role === "system") {
    return "the system — a server action, a migration, or the SQL editor";
  }
  if (entry.actor_role === "recorder") return "a match recorder";
  return "somebody who was not signed in";
}

/**
 * Who and which match, for the rows whose own id says nothing.
 *
 * A match_lineups row is identified by an id nobody has ever seen. What makes
 * it recognisable is the player on it and the fixture it belongs to, and both
 * are sitting in the detail blob — so "Added a player on a team sheet"
 * becomes "Added Kwame Mensah to the team sheet for Bulls v Skolars".
 */
export function contextFor(
  entry: AuditEntry,
  names: Map<string, string>
): { player: string | null; fixture: string | null } {
  const body =
    entry.detail?.new ?? entry.detail?.old ?? entry.detail?.changed ?? null;
  if (!body || typeof body !== "object") return { player: null, fixture: null };

  // A changed-field blob holds [before, after] pairs; take the after.
  const pick = (key: string): string | null => {
    const v = (body as any)[key];
    const id = Array.isArray(v) ? (v[1] ?? v[0]) : v;
    return typeof id === "string" ? (names.get(id) ?? null) : null;
  };

  return { player: pick("player_id"), fixture: pick("fixture_id") };
}

/** Entities whose own id is meaningless to a reader. */
const NEEDS_CONTEXT = new Set([
  "match_lineups",
  "match_events",
  "match_results",
  "match_player_ratings",
  "fixture_officials",
  "team_sheets",
  "player_registrations",
  "player_history",
]);

/**
 * The sentence at the top of the page.
 *
 * The trigger's own summary wins where there is one, because it was written
 * with facts this cannot see. Everything else is built from the action, the
 * thing it happened to, and — for an update — what actually moved.
 */
export function headline(entry: AuditEntry, names: Map<string, string>): string {
  if (entry.summary) return entry.summary;

  const thing = THINGS[entry.entity ?? ""];
  let subject = entry.entity_id ? names.get(entry.entity_id) : null;

  // For a join row, the player and the match are what make it recognisable.
  if (!subject && NEEDS_CONTEXT.has(entry.entity ?? "")) {
    const ctx = contextFor(entry, names);
    const bits = [ctx.player, ctx.fixture ? `in ${ctx.fixture}` : null].filter(
      Boolean
    );
    if (bits.length > 0) subject = bits.join(" ");
  }

  const noun = subject ? `${thing?.one ?? "record"} ${subject}` : (thing?.a ?? "a record");

  if (entry.action.endsWith(".insert")) {
    return `Added the ${noun}`.replace("the a ", "a ");
  }
  if (entry.action.endsWith(".delete")) {
    return `Removed the ${noun}`.replace("the a ", "a ");
  }
  if (entry.action.endsWith(".update")) {
    const fields = changesIn(entry.detail, names);
    if (fields.length === 0) return `Saved the ${noun}`.replace("the a ", "a ");
    if (fields.length === 1) {
      const f = fields[0];
      return `Changed the ${f.label.toLowerCase()} of the ${noun} from ${f.before} to ${f.after}`.replace(
        "the a ",
        "a "
      );
    }
    const named = fields.slice(0, 3).map((f) => f.label.toLowerCase());
    const rest = fields.length - named.length;
    return `Changed ${named.join(", ")}${rest > 0 ? ` and ${rest} more` : ""} on the ${noun}`.replace(
      "the a ",
      "a "
    );
  }

  // account.password_reset and anything else not written by the trigger.
  return entry.action.replace(/^[a-z_]+\./, "").replace(/_/g, " ");
}

/** Where the thing this entry is about can be seen, when it still exists. */
export function subjectHref(entry: AuditEntry): string | null {
  if (!entry.entity_id) return null;
  const to: Record<string, string> = {
    players: "/admin/players",
    teams: "/admin/teams",
    fixtures: "/admin/fixtures",
    competitions: "/admin/competitions",
    venues: "/admin/venues",
    officials: "/admin/officials",
    coaches: "/admin/coaches",
    articles: "/admin/articles",
    suspensions: "/admin/suspensions",
  };
  const base = to[entry.entity ?? ""];
  return base ? `${base}/${entry.entity_id}` : null;
}
