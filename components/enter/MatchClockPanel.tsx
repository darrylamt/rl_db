"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  clockState,
  clockTime,
  displayMinute,
  pauseFields,
  resumeFields,
  resumeFromHalfTimeFields,
  currentHalf,
  WALKOVER_SCORE,
  type MatchClock,
} from "@/lib/matchClock";

type Fixture = MatchClock & {
  fixture_id: string;
  home_team_id: string;
  away_team_id: string;
  home_team?: { name: string } | null;
  away_team?: { name: string } | null;
  forfeited_by_team_id?: string | null;
};

/**
 * Start, stop and finish a match.
 *
 * The buttons write timestamps and nothing else — the minute everyone sees
 * is worked out from those, so this panel going quiet (a dead phone, a lost
 * signal) does not stop the clock for the people watching.
 */
export function MatchClockPanel({
  fixture,
  onChange,
}: {
  fixture: Fixture;
  onChange: () => void;
}) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [askWalkover, setAskWalkover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, tick] = useState(0);

  const state = clockState(fixture);
  const running = state === "running";

  // Re-render once a second so the clock moves. Only while it is running:
  // a stopped clock shows the same thing every second.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function write(fields: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("fixtures")
      .update(fields)
      .eq("fixture_id", fixture.fixture_id);
    setBusy(false);
    if (error) {
      setError(
        /column .* does not exist/i.test(error.message)
          ? "The clock needs supabase/match_clock.sql to be run first."
          : error.message
      );
      return;
    }
    onChange();
  }

  const start = () =>
    write({
      kickoff_at: new Date().toISOString(),
      clock_state: "running",
      paused_at: null,
      stoppage_seconds: 0,
      status: "live",
    });

  const resume = () => write(resumeFields(fixture));
  // The second half begins on 40, whatever the whistle actually went on.
  const secondHalf = () => write(resumeFromHalfTimeFields(fixture));
  const pause = () => write(pauseFields("paused"));
  const halfTime = () => write(pauseFields("half_time"));
  const fullTime = () => write({ ...pauseFields("finished"), status: "completed" });

  /** The side that turned up is awarded the match; nothing is played. */
  async function walkover(forfeitingTeamId: string) {
    const homeForfeited = forfeitingTeamId === fixture.home_team_id;
    setBusy(true);
    setError(null);

    const { error: fixtureError } = await supabase
      .from("fixtures")
      .update({
        status: "completed",
        clock_state: "finished",
        forfeited_by_team_id: forfeitingTeamId,
      })
      .eq("fixture_id", fixture.fixture_id);

    if (fixtureError) {
      setBusy(false);
      setError(fixtureError.message);
      return;
    }

    const { error: resultError } = await supabase.from("match_results").upsert(
      {
        fixture_id: fixture.fixture_id,
        home_score: homeForfeited ? 0 : WALKOVER_SCORE,
        away_score: homeForfeited ? WALKOVER_SCORE : 0,
        notes: `Walkover — ${
          (homeForfeited ? fixture.home_team?.name : fixture.away_team?.name) ?? "one side"
        } did not turn up.`,
      },
      { onConflict: "fixture_id" }
    );

    setBusy(false);
    setAskWalkover(false);
    if (resultError) { setError(resultError.message); return; }
    onChange();
  }

  const Btn = ({
    onClick,
    children,
    tone = "plain",
  }: {
    onClick: () => void;
    children: React.ReactNode;
    tone?: "go" | "stop" | "plain";
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`px-3 py-2 rounded text-sm font-medium disabled:opacity-50 ${
        tone === "go"
          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
          : tone === "stop"
          ? "bg-amber-600 hover:bg-amber-700 text-white"
          : "border border-white/20 text-slate-200 hover:border-white/50"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="bg-neutral-950 border border-white/10 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-2">
          <span className="font-display tabular-nums text-3xl text-ghanaYellow-500">
            {state === "not_started"
              ? "—"
              : state === "half_time"
              ? "HT"
              : state === "finished"
              ? "FT"
              : clockTime(fixture)}
          </span>
          <span className="text-xs text-slate-400">
            {state === "not_started" && "not started"}
            {state === "running" && `${displayMinute(fixture)}' · half ${currentHalf(fixture)}`}
            {state === "paused" && "paused"}
            {state === "half_time" &&
              `half time · ${clockTime(fixture)} played · second half starts on 40'`}
            {state === "finished" && "full time"}
          </span>
        </div>

        <div className="flex gap-2 flex-wrap justify-end">
          {state === "not_started" && (
            <>
              <Btn onClick={start} tone="go">Start match</Btn>
              <Btn onClick={() => setAskWalkover(!askWalkover)}>Walkover</Btn>
            </>
          )}
          {state === "running" && (
            <>
              <Btn onClick={pause} tone="stop">Pause</Btn>
              <Btn onClick={halfTime} tone="stop">Half time</Btn>
              <Btn onClick={fullTime}>Full time</Btn>
            </>
          )}
          {state === "paused" && (
            <>
              <Btn onClick={resume} tone="go">Resume</Btn>
              <Btn onClick={fullTime}>Full time</Btn>
            </>
          )}
          {state === "half_time" && (
            <>
              <Btn onClick={secondHalf} tone="go">Start second half</Btn>
              <Btn onClick={fullTime}>Full time</Btn>
            </>
          )}
          {state === "finished" && (
            <span className="text-xs text-slate-500 self-center">
              {fixture.forfeited_by_team_id ? "Awarded — walkover" : "Match over"}
            </span>
          )}
        </div>
      </div>

      {askWalkover && state === "not_started" && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-slate-400 mb-2">
            Which side did not turn up? The other is awarded the match {WALKOVER_SCORE}–0.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Btn onClick={() => walkover(fixture.home_team_id)}>
              {fixture.home_team?.name ?? "Home"} did not turn up
            </Btn>
            <Btn onClick={() => walkover(fixture.away_team_id)}>
              {fixture.away_team?.name ?? "Away"} did not turn up
            </Btn>
          </div>
        </div>
      )}

      {state === "running" && (
        <p className="text-[11px] text-slate-500 mt-2">
          Events are stamped with the clock minute, and you can change it —
          record something that happened five minutes ago with the minute it
          happened.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
