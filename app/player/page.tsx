import Link from "next/link";
import { requirePlayer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { RadarChart } from "@/components/RadarChart";
import {
  ATTRIBUTE_AXES,
  attributeValues,
  hasAttributes,
  attributeAverage,
} from "@/lib/attributes";
import {
  remaining,
  monthsBetween,
  describeLength,
  type Contract,
} from "@/lib/contracts";
import { normaliseType, EVENT_POINTS } from "@/lib/matchStats";
import { standingsFor, describeStanding } from "@/lib/leaders";
import { answerContract, counterContract } from "./actions";
import { contractDocumentUrl } from "@/lib/contractDocument";

export const dynamic = "force-dynamic";

const COUNTED: [string, string][] = [
  ["try", "Tries"],
  ["conversion", "Conversions"],
  ["missed_conversion", "Missed conversions"],
  ["penalty_goal", "Penalty goals"],
  ["drop_goal", "Drop goals"],
  ["try_assist", "Try assists"],
  ["line_break", "Line breaks"],
  ["tackle", "Tackles"],
  ["tackle_break", "Tackle breaks"],
  ["offload", "Offloads"],
  ["turnover_won", "Turnovers won"],
  ["missed_tackle", "Missed tackles"],
  ["yellow_card", "Yellow cards"],
  ["red_card", "Red cards"],
];

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="bg-neutral-900 border border-white/10 rounded-lg px-3 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-tight">
        {label}
      </div>
      <div
        className={`font-display text-2xl mt-1 tabular-nums ${
          accent ? "text-ghanaYellow-500" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export default async function PlayerHomePage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();

  const [
    { data: player },
    { data: contracts },
    { data: events },
    { data: lineups },
    { data: ratings },
  ] = await Promise.all([
    supabase
      .from("players")
      .select(
        "player_id, first_name, last_name, position, jersey_number, date_of_birth, height_cm, weight_kg, nationality, playing_status, photo_url, team_id, attr_strength, attr_speed, attr_iq, attr_defense, attr_ability, attr_kicking, team:team_id(name)",
      )
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("contracts")
      .select(
        "contract_id, player_id, team_id, starts_on, ends_on, status, terms, decline_note, offered_at, answered_at, document_path, document_name, document_size, team:team_id(name)",
      )
      .eq("player_id", playerId)
      .order("offered_at", { ascending: false }),
    supabase
      .from("match_events")
      .select("event_type, fixture_id")
      .eq("player_id", playerId),
    supabase
      .from("match_lineups")
      .select("fixture_id")
      .eq("player_id", playerId),
    supabase
      .from("match_player_ratings")
      .select("rating")
      .eq("player_id", playerId),
  ]);

  const p = player as any;
  const standings = await standingsFor(playerId);

  const all = (contracts ?? []) as any[];
  const offers = all.filter((c) => c.status === "offered");
  const awaitingClub = all.filter((c) => c.status === "countered");

  // A link that expires, per offer, rather than a public URL anybody who
  // ever saw it could keep reading.
  const docFor = new Map<string, string>();
  for (const c of offers) {
    if (!c.document_path) continue;
    const url = await contractDocumentUrl(c.document_path);
    if (url) docFor.set(c.contract_id, url);
  }
  const live = all.find((c) => c.status === "accepted") ?? null;
  const left = remaining(live as Contract);
  const liveClub = live
    ? (Array.isArray(live.team) ? live.team[0] : live.team)?.name
    : null;

  const tally = new Map<string, number>();
  let points = 0;
  for (const e of (events ?? []) as any[]) {
    const t = normaliseType(e.event_type);
    tally.set(t, (tally.get(t) ?? 0) + 1);
    points += EVENT_POINTS[t] ?? 0;
  }

  // Named on a team sheet, or something recorded against them in the match.
  // Sheets only exist from 2024, so counting them alone loses every earlier
  // season — 22 of Darryl's 35 matches, for one.
  const played = new Set<string>();
  for (const l of (lineups ?? []) as any[])
    if (l.fixture_id) played.add(l.fixture_id);
  for (const e of (events ?? []) as any[])
    if (e.fixture_id) played.add(e.fixture_id);
  const appearances = played.size;
  const marks = ((ratings ?? []) as any[])
    .map((r) => Number(r.rating))
    .filter((n) => !Number.isNaN(n));
  const avgRating = marks.length
    ? (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(1)
    : "—";

  const name =
    `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Player";
  const teamName = (Array.isArray(p?.team) ? p.team[0] : p?.team)?.name;
  const overall = attributeAverage(p);

  return (
    <div className="grid gap-6">
      {searchParams?.error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 text-sm px-3 py-2.5 rounded">
          {searchParams.error}
        </div>
      )}
      {searchParams?.note && (
        <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-200 text-sm px-3 py-2.5 rounded">
          {searchParams.note}
        </div>
      )}

      {/* Who you are */}
      <div className="bg-neutral-900 border border-white/10 rounded-lg p-4 md:p-5">
        <div className="flex items-center gap-4">
          <Avatar src={p?.photo_url} name={name} size={88} />
          <div className="min-w-0">
            <h1 className="font-display text-2xl md:text-3xl font-bold leading-tight break-words">
              {name}
              {p?.playing_status && (
                <span
                  className={`inline-block align-middle ml-2.5 w-2.5 h-2.5 rounded-full ${
                    p.playing_status === "active"
                      ? "bg-emerald-500"
                      : "bg-red-500"
                  }`}
                  title={
                    p.playing_status === "active" ? "Active" : "Not active"
                  }
                />
              )}
              <span className="sr-only">{p?.playing_status}</span>
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              {teamName ?? "No club"}
              {p?.position && (
                <span className="text-slate-500"> · {p.position}</span>
              )}
              {p?.jersey_number != null && (
                <span className="text-slate-500"> · #{p.jersey_number}</span>
              )}
            </p>
            {left && (
              <p className="text-ghanaYellow-500 text-xs mt-1.5">
                {left.label} left on contract
                {liveClub ? ` with ${liveClub}` : ""}
              </p>
            )}
            <p className="text-slate-500 text-xs mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {p?.date_of_birth && (
                <span>
                  Age{" "}
                  {Math.floor(
                    (Date.now() - new Date(p.date_of_birth).getTime()) /
                      31557600000,
                  )}
                </span>
              )}
              {p?.height_cm && <span>{p.height_cm} cm</span>}
              {p?.weight_kg && <span>{p.weight_kg} kg</span>}
              {p?.nationality && <span>{p.nationality}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* What you top */}
      {standings.length > 0 && (
        <div className="grid gap-2">
          {standings.slice(0, 4).map((st, i) => (
            <div
              key={i}
              className={`rounded-lg px-4 py-3 border ${
                st.scope === "all_time"
                  ? "bg-ghanaYellow-500/10 border-ghanaYellow-500/40"
                  : "bg-neutral-900 border-white/10"
              }`}
            >
              <p className="font-display text-base md:text-lg capitalize">
                You are the {describeStanding(st)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {st.count} on record
                {!st.outright &&
                  ` · shared with ${st.sharedWith} other${st.sharedWith === 1 ? "" : "s"}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Offers — the one thing only you can settle */}
      {offers.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-3">
            {offers.length === 1 ? "You have an offer" : "You have offers"}
          </h2>
          <div className="grid gap-3">
            {offers.map((c) => {
              const club = (Array.isArray(c.team) ? c.team[0] : c.team)?.name;
              return (
                <div
                  key={c.contract_id}
                  className="bg-neutral-900 border-2 border-ghanaYellow-500/60 rounded-lg p-4"
                >
                  <p className="font-display text-lg">{club}</p>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {describeLength(monthsBetween(c.starts_on, c.ends_on))} ·
                    from {c.starts_on}
                  </p>
                  {c.terms && (
                    <p className="text-sm text-slate-300 mt-2 break-words">
                      {c.terms}
                    </p>
                  )}
                  {c.document_name && (
                    <p className="text-sm mt-2">
                      {docFor.get(c.contract_id) ? (
                        <a
                          href={docFor.get(c.contract_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-ghanaYellow-500 hover:underline"
                        >
                          Read the contract ({c.document_name}) →
                        </a>
                      ) : (
                        <span className="text-slate-500">
                          {c.document_name} is attached but could not be opened.
                        </span>
                      )}
                    </p>
                  )}

                  {/* Countering keeps the offer alive; refusing ends it. */}
                  <form
                    action={counterContract.bind(null, c.contract_id)}
                    className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end bg-neutral-950 border border-white/10 rounded p-3"
                  >
                    <label className="text-[11px] text-slate-400">
                      <span className="block mb-0.5">You would start</span>
                      <input
                        type="date"
                        name="starts_on"
                        required
                        defaultValue={c.starts_on}
                        className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-white/15 text-white text-xs"
                      />
                    </label>
                    <label className="text-[11px] text-slate-400">
                      <span className="block mb-0.5">and finish</span>
                      <input
                        type="date"
                        name="ends_on"
                        required
                        defaultValue={c.ends_on}
                        className="w-full px-2 py-1.5 rounded bg-neutral-900 border border-white/15 text-white text-xs"
                      />
                    </label>
                    <button className="text-xs px-3 py-2 rounded border border-white/20 text-slate-200 hover:border-white/50">
                      Counter
                    </button>
                    <input
                      name="note"
                      placeholder="Why — the club sees this"
                      className="sm:col-span-3 px-2 py-1.5 rounded bg-neutral-900 border border-white/15 text-white text-xs"
                    />
                  </form>

                  <div className="flex flex-wrap gap-2 mt-3">
                    <form
                      action={answerContract.bind(null, c.contract_id, true)}
                    >
                      <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded">
                        Accept
                      </button>
                    </form>
                    <form
                      action={answerContract.bind(null, c.contract_id, false)}
                      className="flex gap-1.5 flex-1 min-w-[13rem]"
                    >
                      <input
                        name="why"
                        placeholder="why not? optional"
                        className="flex-1 min-w-0 text-sm px-2 py-2 rounded bg-neutral-950 border border-white/15 text-white"
                      />
                      <button className="text-sm px-3 py-2 rounded border border-red-500/50 text-red-300 hover:bg-red-500/10 shrink-0">
                        Turn down
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {awaitingClub.length > 0 && (
        <section>
          <h2 className="font-display text-xl mb-3">With the club</h2>
          <div className="grid gap-2">
            {awaitingClub.map((c) => {
              const club = (Array.isArray(c.team) ? c.team[0] : c.team)?.name;
              return (
                <div
                  key={c.contract_id}
                  className="bg-neutral-900 border border-violet-700/40 rounded-lg px-4 py-3 text-sm"
                >
                  <p>
                    You countered {club}:{" "}
                    <span className="text-slate-400">
                      {describeLength(monthsBetween(c.starts_on, c.ends_on))},{" "}
                      {c.starts_on} to {c.ends_on}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Waiting on them to accept or come back again.
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Matches" value={appearances} />
        <Stat label="Points" value={points} accent />
        <Stat label="Tries" value={tally.get("try") ?? 0} />
        <Stat label="Avg rating" value={avgRating} />
      </div>

      {/* Attributes */}
      {hasAttributes(p) && (
        <section>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <h2 className="font-display text-xl">Attributes</h2>
            {overall != null && (
              <span className="text-xs uppercase tracking-wider text-slate-500">
                Overall {overall}
              </span>
            )}
          </div>
          <div className="bg-neutral-900 border border-white/10 rounded-lg p-4">
            <RadarChart
              axes={ATTRIBUTE_AXES}
              series={[
                {
                  label: name,
                  values: attributeValues(p).map((v) => v ?? 0),
                  color: "#c8102e",
                },
              ]}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Set by the federation. Speak to your club if you think one is wrong.
          </p>
        </section>
      )}

      {/* Everything on record */}
      <section>
        <h2 className="font-display text-xl mb-3">Your record</h2>
        {tally.size === 0 ? (
          <p className="bg-neutral-900 border border-white/10 rounded-lg px-4 py-6 text-center text-slate-500 text-sm">
            Nothing recorded against your name yet.
          </p>
        ) : (
          <div className="bg-neutral-900 border border-white/10 rounded-lg divide-y divide-white/5">
            {COUNTED.filter(([k]) => tally.get(k)).map(([k, label]) => (
              <div key={k} className="px-4 py-2.5 flex justify-between text-sm">
                <span className="text-slate-300">{label}</span>
                <span className="font-display tabular-nums text-white">
                  {tally.get(k)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-sm">
        <Link
          href="/player/availability"
          className="text-ghanaYellow-500 hover:underline"
        >
          Tell your club which matches you are available for →
        </Link>
      </p>
    </div>
  );
}
