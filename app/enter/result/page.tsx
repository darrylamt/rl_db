"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Field,
  TextInput,
  NumberInput,
  Select,
  SubmitButton,
  Notice,
} from "@/components/FormFields";

type Competition = { competition_id: string; name: string; season: string | null };
type Fixture = {
  fixture_id: string;
  scheduled_date: string | null;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
};

export default function EnterResultPage() {
  const supabase = createClient();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);

  const [competitionId, setCompetitionId] = useState("");
  const [fixtureId, setFixtureId] = useState("");

  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [homeTries, setHomeTries] = useState("");
  const [awayTries, setAwayTries] = useState("");
  const [homeConv, setHomeConv] = useState("");
  const [awayConv, setAwayConv] = useState("");
  const [homePen, setHomePen] = useState("");
  const [awayPen, setAwayPen] = useState("");
  const [homeDg, setHomeDg] = useState("");
  const [awayDg, setAwayDg] = useState("");
  const [attendance, setAttendance] = useState("");
  const [recordedBy, setRecordedBy] = useState("");

  const [status, setStatus] = useState<
    { kind: "error" | "success"; msg: string } | null
  >(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("competitions")
        .select("competition_id, name, season")
        .order("name")
        .order("season", { ascending: false });
      setCompetitions((data ?? []) as any);
    })();
  }, [supabase]);

  // Arriving from the match-day list as /enter/result?fixture=<id>. The
  // fixture picker is filtered by competition, so the competition has to be
  // chosen before the fixture can be — look it up rather than making the
  // recorder guess which competition their match belongs to.
  const [wantedFixture, setWantedFixture] = useState<string | null>(null);
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("fixture");
    if (!wanted) return;
    setWantedFixture(wanted);
    (async () => {
      const { data } = await supabase
        .from("fixtures")
        .select("competition_id")
        .eq("fixture_id", wanted)
        .maybeSingle();
      if (data?.competition_id) setCompetitionId(data.competition_id as string);
    })();
  }, [supabase]);

  useEffect(() => {
    if (!competitionId) {
      setFixtures([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("fixtures")
        .select(
          "fixture_id, scheduled_date, home_team:home_team_id(name), away_team:away_team_id(name)"
        )
        .eq("competition_id", competitionId)
        .order("scheduled_date", { ascending: false });
      const list = (data ?? []) as any[];
      setFixtures(list as any);
      // Only once, and only if it really is in this competition's list.
      if (wantedFixture && list.some((f) => f.fixture_id === wantedFixture)) {
        setFixtureId(wantedFixture);
        setWantedFixture(null);
      }
    })();
  }, [supabase, competitionId, wantedFixture]);

  const selectedFixture = useMemo(
    () => fixtures.find((f) => f.fixture_id === fixtureId) || null,
    [fixtures, fixtureId]
  );

  /**
   * What is already recorded against this match.
   *
   * The form only ever wrote: pick a match that already has a result and
   * every box was blank, so there was nothing to correct and saving put
   * zeroes over tries, conversions and attendance that were already right.
   * Filling in a single wrong score meant retyping the rest from memory.
   *
   * Loaded whenever the match changes, and cleared when there is nothing on
   * record so a fresh match does not inherit the last one's numbers.
   */
  const [existing, setExisting] = useState<"none" | "loading" | "found">(
    "none"
  );
  useEffect(() => {
    if (!fixtureId) {
      setExisting("none");
      return;
    }
    let live = true;
    setExisting("loading");
    (async () => {
      const { data } = await supabase
        .from("match_results")
        .select(
          "home_score, away_score, home_tries, away_tries, home_conversions, away_conversions, home_penalties, away_penalties, home_drop_goals, away_drop_goals, attendance, recorded_by"
        )
        .eq("fixture_id", fixtureId)
        .maybeSingle();
      if (!live) return;

      const str = (v: any) => (v === null || v === undefined ? "" : String(v));
      setHomeScore(str(data?.home_score));
      setAwayScore(str(data?.away_score));
      setHomeTries(str(data?.home_tries));
      setAwayTries(str(data?.away_tries));
      setHomeConv(str(data?.home_conversions));
      setAwayConv(str(data?.away_conversions));
      setHomePen(str(data?.home_penalties));
      setAwayPen(str(data?.away_penalties));
      setHomeDg(str(data?.home_drop_goals));
      setAwayDg(str(data?.away_drop_goals));
      setAttendance(str(data?.attendance));
      setRecordedBy(str(data?.recorded_by));
      setExisting(data ? "found" : "none");
    })();
    return () => {
      live = false;
    };
  }, [supabase, fixtureId]);

  function intOrNull(s: string) {
    if (s.trim() === "") return null;
    const n = parseInt(s, 10);
    return isNaN(n) ? null : n;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (!fixtureId) return;
    setLoading(true);

    const payload = {
      fixture_id: fixtureId,
      home_score: intOrNull(homeScore) ?? 0,
      away_score: intOrNull(awayScore) ?? 0,
      home_tries: intOrNull(homeTries) ?? 0,
      away_tries: intOrNull(awayTries) ?? 0,
      home_conversions: intOrNull(homeConv) ?? 0,
      away_conversions: intOrNull(awayConv) ?? 0,
      home_penalties: intOrNull(homePen) ?? 0,
      away_penalties: intOrNull(awayPen) ?? 0,
      home_drop_goals: intOrNull(homeDg) ?? 0,
      away_drop_goals: intOrNull(awayDg) ?? 0,
      attendance: intOrNull(attendance),
      recorded_by: recordedBy || null,
    };

    // Upsert by fixture_id (unique constraint)
    const { error: resErr } = await supabase
      .from("match_results")
      .upsert(payload, { onConflict: "fixture_id" });

    if (resErr) {
      setLoading(false);
      setStatus({ kind: "error", msg: resErr.message });
      return;
    }

    // Mark fixture as completed
    const { error: fErr } = await supabase
      .from("fixtures")
      .update({ status: "completed" })
      .eq("fixture_id", fixtureId);

    setLoading(false);
    if (fErr) {
      setStatus({ kind: "error", msg: `Result saved, but could not mark fixture complete: ${fErr.message}` });
      return;
    }
    setStatus({ kind: "success", msg: "Result saved. Fixture marked completed." });
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold mb-1">Enter Match Result</h1>
      <p className="text-navy-200 text-sm mb-6">Score and breakdown for a completed fixture.</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Competition">
          <Select
            required
            value={competitionId}
            onChange={(e) => {
              setCompetitionId(e.target.value);
              setFixtureId("");
            }}
          >
            <option value="">— Select competition —</option>
            {competitions.map((c) => (
              <option key={c.competition_id} value={c.competition_id}>
                {c.name}{c.season ? ` · ${c.season}` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Fixture">
          <Select
            required
            value={fixtureId}
            onChange={(e) => setFixtureId(e.target.value)}
            disabled={!competitionId}
          >
            <option value="">— Select fixture —</option>
            {fixtures.map((f) => (
              <option key={f.fixture_id} value={f.fixture_id}>
                {f.home_team?.name} vs {f.away_team?.name} — {f.scheduled_date}
              </option>
            ))}
          </Select>
        </Field>

        {selectedFixture && (
          <div className="bg-navy-800 border border-navy-700 rounded p-3 text-sm text-navy-100">
            <span className="text-gold-400">Scoring:</span>{" "}
            {selectedFixture.home_team?.name}{" "}
            <span className="text-navy-400">vs</span>{" "}
            {selectedFixture.away_team?.name}
            {existing === "found" && (
              <span className="block text-xs text-ghanaYellow-500 mt-1">
                This match already has a result. The boxes below hold what is
                on record — change what is wrong and leave the rest.
              </span>
            )}
          </div>
        )}

        {/* Everything a recorder can set for this match that is not a score. */}
        {fixtureId && (
          <a
            href={`/enter/match/${fixtureId}`}
            className="block text-center text-sm font-medium border border-white/15 rounded px-3 py-2.5 hover:bg-white/5"
          >
            Team sheets, coaches and officials &rarr;
          </a>
        )}

        <div className="pt-2">
          <h2 className="font-display text-gold-400 text-sm tracking-widest mb-2">
            FINAL SCORE
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Home score">
              <NumberInput
                required
                min={0}
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
              />
            </Field>
            <Field label="Away score">
              <NumberInput
                required
                min={0}
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
              />
            </Field>
          </div>
        </div>

        <div className="pt-2">
          <h2 className="font-display text-gold-400 text-sm tracking-widest mb-2">
            BREAKDOWN
          </h2>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <Field label="Home tries">
              <NumberInput min={0} value={homeTries} onChange={(e) => setHomeTries(e.target.value)} />
            </Field>
            <div className="text-navy-400 pb-3 text-xs">Tries</div>
            <Field label="Away tries">
              <NumberInput min={0} value={awayTries} onChange={(e) => setAwayTries(e.target.value)} />
            </Field>

            <Field label="Home conv.">
              <NumberInput min={0} value={homeConv} onChange={(e) => setHomeConv(e.target.value)} />
            </Field>
            <div className="text-navy-400 pb-3 text-xs">Conv.</div>
            <Field label="Away conv.">
              <NumberInput min={0} value={awayConv} onChange={(e) => setAwayConv(e.target.value)} />
            </Field>

            <Field label="Home pen.">
              <NumberInput min={0} value={homePen} onChange={(e) => setHomePen(e.target.value)} />
            </Field>
            <div className="text-navy-400 pb-3 text-xs">Pen.</div>
            <Field label="Away pen.">
              <NumberInput min={0} value={awayPen} onChange={(e) => setAwayPen(e.target.value)} />
            </Field>

            <Field label="Home DG">
              <NumberInput min={0} value={homeDg} onChange={(e) => setHomeDg(e.target.value)} />
            </Field>
            <div className="text-navy-400 pb-3 text-xs">DG</div>
            <Field label="Away DG">
              <NumberInput min={0} value={awayDg} onChange={(e) => setAwayDg(e.target.value)} />
            </Field>
          </div>
        </div>

        <Field label="Attendance">
          <NumberInput
            min={0}
            value={attendance}
            onChange={(e) => setAttendance(e.target.value)}
          />
        </Field>

        <Field label="Recorded by (your name)">
          <TextInput
            value={recordedBy}
            onChange={(e) => setRecordedBy(e.target.value)}
            placeholder="e.g. K. Mensah"
          />
        </Field>

        {status && <Notice kind={status.kind}>{status.msg}</Notice>}
        <SubmitButton loading={loading} disabled={!fixtureId}>
          Save Result
        </SubmitButton>
      </form>
    </>
  );
}
