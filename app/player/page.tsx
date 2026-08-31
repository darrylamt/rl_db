import Link from "next/link";
import { requirePlayer } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { remaining, monthsBetween, describeLength, type Contract } from "@/lib/contracts";
import { normaliseType } from "@/lib/matchStats";
import { standingsFor } from "@/lib/leaders";
import { answerContract } from "./actions";

export const dynamic = "force-dynamic";

const COUNTED = [
  ["try", "Tries"],
  ["conversion", "Conversions"],
  ["penalty_goal", "Penalty goals"],
  ["drop_goal", "Drop goals"],
  ["try_assist", "Try assists"],
  ["line_break", "Line breaks"],
  ["tackle", "Tackles"],
  ["tackle_break", "Tackle breaks"],
  ["offload", "Offloads"],
  ["missed_tackle", "Missed tackles"],
  ["yellow_card", "Yellow cards"],
  ["red_card", "Red cards"],
] as const;

export default async function PlayerHomePage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  const { playerId } = await requirePlayer();
  const supabase = createAdminClient();

  const [{ data: player }, { data: contracts }, { data: events }, { data: lineups }, { data: ratings }] =
    await Promise.all([
      supabase
        .from("players")
        .select(
          "player_id, first_name, last_name, position, jersey_number, date_of_birth, height_cm, weight_kg, nationality, rating, team_id, attr_strength, attr_speed, attr_iq, attr_defense, attr_ability, attr_kicking, team:team_id(name)"
        )
        .eq("player_id", playerId)
        .maybeSingle(),
      supabase
        .from("contracts")
        .select(
          "contract_id, player_id, team_id, starts_on, ends_on, status, terms, decline_note, offered_at, answered_at, team:team_id(name, logo_url)"
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

  // What they top, if anything. Worked out after the player is known,
  // because it needs their club to know what "at your club" means.
  const standings = await standingsFor(playerId, p?.team_id ?? null);
  const all = (contracts ?? []) as any[];
  const offers = all.filter((c) => c.status === "offered");
  const live = all.find((c) => c.status === "accepted") ?? null;
  const left = remaining(live as Contract);

  const tally = new Map<string, number>();
  for (const e of (events ?? []) as any[]) {
    const t = normaliseType(e.event_type);
    tally.set(t, (tally.get(t) ?? 0) + 1);
  }

  const appearances = new Set(((lineups ?? []) as any[]).map((l) => l.fixture_id)).size;
  const marks = ((ratings ?? []) as any[]).map((r) => Number(r.rating)).filter((n) => !Number.isNaN(n));
  const avgRating = marks.length
    ? (marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(1)
    : null;

  const attrs = [
    ["Strength", p?.attr_strength],
    ["Speed", p?.attr_speed],
    ["Game IQ", p?.attr_iq],
    ["Defence", p?.attr_defense],
    ["Ability", p?.attr_ability],
    ["Kicking", p?.attr_kicking],
  ].filter(([, v]) => v != null) as [string, number][];

  return (
    <div className="grid gap-6">
      {searchParams?.error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2.5 rounded">
          {searchParams.error}
        </div>
      )}
      {searchParams?.note && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm px-3 py-2.5 rounded">
          {searchParams.note}
        </div>
      )}

      {standings.length > 0 && (
        <section className="grid gap-2">
          {standings.slice(0, 3).map((s, i) => (
            <div
              key={i}
              className={`rounded-lg px-4 py-3 border ${
                s.scope === "federation"
                  ? "bg-gold-50 border-gold-300"
                  : "bg-white border-slate-200"
              }`}
            >
              <p className="text-sm">
                <span className="font-display text-lg text-navy-900">
                  {s.outright ? "You are the" : "You are joint"} {s.title}
                </span>
                <span className="text-slate-600">
                  {" "}
                  {s.scope === "federation" ? "in the federation" : `at ${s.scopeName}`}
                </span>
              </p>
              <p className="text-xs text-slate-600 mt-0.5">
                {s.count} on record
                {!s.outright &&
                  ` · shared with ${s.sharedWith} other${s.sharedWith === 1 ? "" : "s"}`}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Offers first — this is the one thing only you can settle */}
      {offers.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-navy-900 mb-2">
            {offers.length === 1 ? "A club has offered you terms" : "Clubs have offered you terms"}
          </h2>
          <div className="grid gap-3">
            {offers.map((c) => {
              const months = monthsBetween(c.starts_on, c.ends_on);
              return (
                <div key={c.contract_id} className="bg-white border-2 border-gold-400 rounded-lg p-4">
                  <p className="font-medium text-navy-900">{c.team?.name}</p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    {describeLength(months)} — {c.starts_on} to {c.ends_on}
                  </p>
                  {c.terms && (
                    <p className="text-sm text-slate-700 mt-2 break-words">{c.terms}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3">
                    <form action={answerContract.bind(null, c.contract_id, true)}>
                      <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded">
                        Accept
                      </button>
                    </form>
                    <form
                      action={answerContract.bind(null, c.contract_id, false)}
                      className="flex gap-1.5 flex-1 min-w-[14rem]"
                    >
                      <input
                        name="why"
                        placeholder="why not? optional"
                        className="flex-1 min-w-0 text-sm px-2 py-2 rounded border border-slate-300"
                      />
                      <button className="text-sm px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50 shrink-0">
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

      {/* Where you stand */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="bg-navy-900 text-white rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-navy-200">Contract</p>
          <p className="font-display text-2xl font-bold leading-tight">
            {left ? left.label : "None"}
          </p>
          <p className="text-[11px] text-navy-300 mt-0.5">
            {left ? `with ${live?.team?.name}, to ${left.endsOn}` : "no contract running"}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Appearances</p>
          <p className="font-display text-3xl text-navy-900 tabular-nums">{appearances}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Average rating</p>
          <p className="font-display text-3xl text-navy-900 tabular-nums">
            {avgRating ?? "—"}
          </p>
        </div>
      </section>

      {/* Your record */}
      <section>
        <h2 className="font-display text-lg text-navy-900 mb-2">Your record</h2>
        {tally.size === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-500 text-sm">
            Nothing recorded against your name yet.
          </div>
        ) : (
          <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {COUNTED.filter(([k]) => tally.get(k)).map(([k, label]) => (
              <li key={k} className="px-4 py-2.5 flex justify-between text-sm">
                <span className="text-slate-700">{label}</span>
                <span className="font-display tabular-nums text-navy-900">
                  {tally.get(k)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {attrs.length > 0 && (
        <section>
          <h2 className="font-display text-lg text-navy-900 mb-2">
            How the federation rates you
          </h2>
          <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {attrs.map(([label, value]) => (
              <li key={label} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-slate-700">{label}</span>
                <span className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                  <span
                    className="block h-full bg-navy-700"
                    style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                  />
                </span>
                <span className="w-8 text-right font-display tabular-nums text-navy-900">
                  {value}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-2">
            Set by the federation. Speak to your club if you think one is wrong.
          </p>
        </section>
      )}

      <p className="text-sm">
        <Link href="/player/availability" className="text-navy-700 hover:underline">
          Tell your club which matches you are available for →
        </Link>
      </p>
    </div>
  );
}
