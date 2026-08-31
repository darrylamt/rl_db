"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clockState, displayMinute, currentHalf } from "@/lib/matchClock";

type Player = {
  player_id: string;
  first_name: string;
  last_name: string;
  team_id: string;
  jersey_number: number | null;
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * A substitution: one player off, one on, at a minute.
 *
 * Recorded as two events rather than one, because match_events belongs to a
 * single player and both of them have done something worth having on their
 * record. They share a minute and a note naming the other, so a timeline can
 * put them together and a profile can show either half on its own.
 *
 * Both are written before either is reported, and if the second fails the
 * first is removed — a substitution with only one half is worse than none,
 * because it reads as a player leaving the field and nobody replacing them.
 */
export function SubstitutionPad({
  fixtureId,
  fixture,
  players,
  namedIds,
  onRecorded,
}: {
  fixtureId: string;
  fixture: any;
  players: Player[];
  namedIds: Set<string>;
  onRecorded: () => void;
}) {
  const supabase = createClient();
  const [side, setSide] = useState<"home" | "away">("home");
  const [off, setOff] = useState("");
  const [on, setOn] = useState("");
  const [minute, setMinute] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; msg: string } | null>(null);

  const teamId = side === "home" ? fixture?.home_team_id : fixture?.away_team_id;

  const squad = useMemo(
    () =>
      players
        .filter((p) => p.team_id === teamId)
        .sort((a, b) => (a.jersey_number ?? 999) - (b.jersey_number ?? 999)),
    [players, teamId]
  );

  const label = (p: Player) =>
    `${p.jersey_number != null ? `${p.jersey_number}. ` : ""}${p.first_name} ${p.last_name}`.trim();

  // The clock's minute unless the recorder has typed one, the same rule the
  // scoring form follows.
  const clockMinute =
    clockState(fixture) === "running" ? String(displayMinute(fixture)) : "";
  const effectiveMinute = minute || clockMinute;

  async function record() {
    if (!off || !on || off === on || busy) return;
    const goingOff = players.find((p) => p.player_id === off);
    const comingOn = players.find((p) => p.player_id === on);
    if (!goingOff || !comingOn) return;

    setBusy(true);
    setNotice(null);

    const m = effectiveMinute ? parseInt(effectiveMinute, 10) : null;
    const half = m != null ? (m > 40 ? 2 : 1) : null;
    const offId = newId();
    const onId = newId();

    const { error: offError } = await supabase.from("match_events").insert({
      event_id: offId,
      fixture_id: fixtureId,
      player_id: goingOff.player_id,
      team_id: goingOff.team_id,
      event_type: "sub_off",
      minute: Number.isNaN(m as number) ? null : m,
      half,
      notes: `Replaced by ${label(comingOn)}`,
    });

    if (offError) {
      setBusy(false);
      setNotice({ ok: false, msg: offError.message });
      return;
    }

    const { error: onError } = await supabase.from("match_events").insert({
      event_id: onId,
      fixture_id: fixtureId,
      player_id: comingOn.player_id,
      team_id: comingOn.team_id,
      event_type: "sub_on",
      minute: Number.isNaN(m as number) ? null : m,
      half,
      notes: `Replaced ${label(goingOff)}`,
    });

    if (onError) {
      // Half a substitution is worse than none.
      await supabase.from("match_events").delete().eq("event_id", offId);
      setBusy(false);
      setNotice({ ok: false, msg: onError.message });
      return;
    }

    setBusy(false);
    setNotice({
      ok: true,
      msg: `✓ ${label(comingOn)} on for ${label(goingOff)}${m != null && !Number.isNaN(m) ? ` — ${m}'` : ""}`,
    });
    setOff("");
    setOn("");
    setMinute("");
    onRecorded();
    setTimeout(() => setNotice(null), 4000);
  }

  return (
    <div className="bg-neutral-950 border border-white/10 rounded-lg p-3">
      <h3 className="text-ghanaYellow-500 font-display text-sm tracking-widest mb-3">
        SUBSTITUTION
      </h3>

      <div className="flex gap-1 bg-neutral-900 rounded-md p-1 mb-3">
        {(["home", "away"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSide(s);
              setOff("");
              setOn("");
            }}
            className={`flex-1 px-3 py-1.5 rounded text-sm ${
              side === s ? "bg-white/10 text-white font-medium" : "text-slate-400"
            }`}
          >
            {s === "home"
              ? fixture?.home_team?.name ?? "Home"
              : fixture?.away_team?.name ?? "Away"}
          </button>
        ))}
      </div>

      <div className="grid gap-2">
        <label className="text-xs text-slate-400">
          <span className="block mb-1">Coming off</span>
          <select
            value={off}
            onChange={(e) => setOff(e.target.value)}
            className="w-full px-3 py-2 rounded bg-neutral-900 border border-white/15 text-white text-sm"
          >
            <option value="">— pick a player —</option>
            {squad.map((p) => (
              <option key={p.player_id} value={p.player_id}>
                {label(p)}
                {namedIds.has(p.player_id) ? "" : " (not on the sheet)"}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          <span className="block mb-1">Coming on for them</span>
          <select
            value={on}
            onChange={(e) => setOn(e.target.value)}
            className="w-full px-3 py-2 rounded bg-neutral-900 border border-white/15 text-white text-sm"
          >
            <option value="">— pick a player —</option>
            {squad
              .filter((p) => p.player_id !== off)
              .map((p) => (
                <option key={p.player_id} value={p.player_id}>
                  {label(p)}
                  {namedIds.has(p.player_id) ? "" : " (not on the sheet)"}
                </option>
              ))}
          </select>
        </label>

        <label className="text-xs text-slate-400">
          <span className="block mb-1">
            Minute
            {clockMinute && !minute && (
              <span className="text-slate-500"> — the clock says {clockMinute}</span>
            )}
          </span>
          <input
            type="number"
            min={0}
            max={90}
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
            placeholder={clockMinute || "e.g. 52"}
            className="w-24 px-3 py-2 rounded bg-neutral-900 border border-white/15 text-white text-sm"
          />
        </label>

        <button
          type="button"
          onClick={record}
          disabled={!off || !on || off === on || busy}
          className="mt-1 w-full py-3 rounded-lg bg-ghanaYellow-500 hover:bg-ghanaYellow-400 disabled:bg-neutral-800 disabled:text-slate-500 text-black font-bold text-sm"
        >
          {busy ? "Recording..." : "Record the substitution"}
        </button>
      </div>

      {notice && (
        <p
          className={`text-xs mt-2 ${notice.ok ? "text-emerald-400" : "text-red-400"}`}
        >
          {notice.msg}
        </p>
      )}
    </div>
  );
}
