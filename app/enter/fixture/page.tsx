"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Field,
  TextInput,
  Select,
  SubmitButton,
  Notice,
} from "@/components/FormFields";

type Row = { id: string; name: string };

export default function EnterFixturePage() {
  const supabase = createClient();
  const [competitions, setCompetitions] = useState<Row[]>([]);
  const [teams, setTeams] = useState<Row[]>([]);
  const [venues, setVenues] = useState<Row[]>([]);

  const [competitionId, setCompetitionId] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [round, setRound] = useState("");

  const [status, setStatus] = useState<
    { kind: "error" | "success"; msg: string } | null
  >(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: comps }, { data: t }, { data: v }] = await Promise.all([
        supabase
          .from("competitions")
          .select("competition_id, name")
          .order("name"),
        supabase.from("teams").select("team_id, name").order("name"),
        supabase.from("venues").select("venue_id, name").order("name"),
      ]);
      setCompetitions(
        (comps ?? []).map((r: any) => ({ id: r.competition_id, name: r.name }))
      );
      setTeams((t ?? []).map((r: any) => ({ id: r.team_id, name: r.name })));
      setVenues((v ?? []).map((r: any) => ({ id: r.venue_id, name: r.name })));
    })();
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
      setStatus({ kind: "error", msg: "Home and away team must be different." });
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("fixtures").insert({
      competition_id: competitionId || null,
      home_team_id: homeTeamId || null,
      away_team_id: awayTeamId || null,
      venue_id: venueId || null,
      scheduled_date: scheduledDate || null,
      scheduled_time: scheduledTime || null,
      round: round || null,
    });
    setLoading(false);
    if (error) {
      setStatus({ kind: "error", msg: error.message });
      return;
    }
    setStatus({ kind: "success", msg: "Fixture created." });
    setHomeTeamId("");
    setAwayTeamId("");
    setVenueId("");
    setScheduledDate("");
    setScheduledTime("");
    setRound("");
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold mb-1">Enter Fixture</h1>
      <p className="text-navy-200 text-sm mb-6">
        Schedule a new match.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Competition">
          <Select
            required
            value={competitionId}
            onChange={(e) => setCompetitionId(e.target.value)}
          >
            <option value="">— Select competition —</option>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Home team">
            <Select
              required
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
            >
              <option value="">— Home —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Away team">
            <Select
              required
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
            >
              <option value="">— Away —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Venue">
          <Select
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
          >
            <option value="">— Select venue —</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <TextInput
              type="date"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </Field>
          <Field label="Time">
            <TextInput
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Round (optional)">
          <TextInput
            value={round}
            onChange={(e) => setRound(e.target.value)}
            placeholder="e.g. Round 4, Semi-final"
          />
        </Field>

        {status && <Notice kind={status.kind}>{status.msg}</Notice>}
        <SubmitButton loading={loading}>Create Fixture</SubmitButton>
      </form>
    </>
  );
}
