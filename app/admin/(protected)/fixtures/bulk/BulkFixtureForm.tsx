"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateFixtures } from "../actions";

interface Team   { team_id: string; name: string }
interface Comp   { competition_id: string; name: string; season?: string | null }
interface Venue  { venue_id: string; name: string }

interface FixtureRow {
  id: number;
  home_team_id: string;
  away_team_id: string;
  date: string;
  time: string;
  round: string;
}

let nextId = 1;

function emptyRow(defaultDate: string, defaultTime: string, defaultRound: string): FixtureRow {
  return { id: nextId++, home_team_id: "", away_team_id: "", date: defaultDate, time: defaultTime, round: defaultRound };
}

export function BulkFixtureForm({
  teams,
  comps,
  venues,
}: {
  teams: Team[];
  comps: Comp[];
  venues: Venue[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Shared defaults
  const [compId, setCompId]     = useState("");
  const [venueId, setVenueId]   = useState("");
  const [defaultDate, setDefaultDate] = useState("");
  const [defaultTime, setDefaultTime] = useState("");
  const [defaultRound, setDefaultRound] = useState("");

  // Rows
  const [rows, setRows] = useState<FixtureRow[]>(() => [emptyRow("", "", "")]);

  function addRow() {
    setRows((prev) => [...prev, emptyRow(defaultDate, defaultTime, defaultRound)]);
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: number, patch: Partial<FixtureRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const valid = rows.filter((r) => r.home_team_id && r.away_team_id && r.home_team_id !== r.away_team_id);
    if (valid.length === 0) {
      setError("Add at least one fixture row with different home and away teams.");
      return;
    }

    const fixtures = valid.map((r) => ({
      competition_id:  compId  || null,
      venue_id:        venueId || null,
      home_team_id:    r.home_team_id,
      away_team_id:    r.away_team_id,
      scheduled_date:  r.date  || null,
      scheduled_time:  r.time  || null,
      round:           r.round || null,
      status:          "scheduled",
    }));

    const fd = new FormData();
    fd.append("fixtures_json", JSON.stringify(fixtures));

    startTransition(async () => {
      try {
        await bulkCreateFixtures(fd);
        setSuccess(`${fixtures.length} fixture${fixtures.length !== 1 ? "s" : ""} created.`);
        setRows([emptyRow(defaultDate, defaultTime, defaultRound)]);
        router.refresh();
      } catch (err: any) {
        setError(err.message ?? "Failed to create fixtures");
      }
    });
  }

  const invalidRows = rows.filter(
    (r) => r.home_team_id && r.away_team_id && r.home_team_id === r.away_team_id
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded">
          {success}
        </div>
      )}

      {/* Shared settings */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Shared Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Competition</label>
            <select
              value={compId}
              onChange={(e) => setCompId(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
              <option value="">— None —</option>
              {comps.map((c) => (
                <option key={c.competition_id} value={c.competition_id}>
                  {c.name}{c.season ? ` · ${c.season}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Venue</label>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            >
              <option value="">— None —</option>
              {venues.map((v) => (
                <option key={v.venue_id} value={v.venue_id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Default date</label>
            <input
              type="date"
              value={defaultDate}
              onChange={(e) => setDefaultDate(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Default time</label>
            <input
              type="time"
              value={defaultTime}
              onChange={(e) => setDefaultTime(e.target.value)}
              className="w-full px-3 py-2 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-navy-500"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Competition, venue, date and time apply to all rows unless overridden per row.
        </p>
      </div>

      {/* Fixture rows */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-navy-900">Fixtures</h3>
          <span className="text-xs text-slate-400">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Home Team</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Away Team</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-24">Round</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => {
                const sameTeam = row.home_team_id && row.away_team_id && row.home_team_id === row.away_team_id;
                return (
                  <tr key={row.id} className={sameTeam ? "bg-red-50/40" : ""}>
                    <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>

                    {/* Home */}
                    <td className="px-2 py-2">
                      <select
                        value={row.home_team_id}
                        onChange={(e) => updateRow(row.id, { home_team_id: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-navy-500"
                      >
                        <option value="">— Home —</option>
                        {teams.map((t) => (
                          <option key={t.team_id} value={t.team_id}>{t.name}</option>
                        ))}
                      </select>
                    </td>

                    {/* Away */}
                    <td className="px-2 py-2">
                      <select
                        value={row.away_team_id}
                        onChange={(e) => updateRow(row.id, { away_team_id: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-navy-500"
                      >
                        <option value="">— Away —</option>
                        {teams.map((t) => (
                          <option key={t.team_id} value={t.team_id}>{t.name}</option>
                        ))}
                      </select>
                      {sameTeam && (
                        <p className="text-xs text-red-500 mt-0.5">Same team selected</p>
                      )}
                    </td>

                    {/* Date override */}
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row.date || defaultDate}
                        onChange={(e) => updateRow(row.id, { date: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-navy-500"
                      />
                    </td>

                    {/* Time override */}
                    <td className="px-2 py-2">
                      <input
                        type="time"
                        value={row.time || defaultTime}
                        onChange={(e) => updateRow(row.id, { time: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-navy-500"
                      />
                    </td>

                    {/* Round */}
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={row.round}
                        onChange={(e) => updateRow(row.id, { round: e.target.value })}
                        placeholder="e.g. R1"
                        className="w-full px-2 py-1.5 rounded border border-slate-300 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-navy-500"
                      />
                    </td>

                    {/* Remove */}
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        disabled={rows.length === 1}
                        className="text-slate-300 hover:text-red-500 transition-colors text-lg leading-none disabled:opacity-30"
                        title="Remove row"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900 font-medium"
          >
            <span className="text-lg leading-none">+</span> Add row
          </button>
          {invalidRows.length > 0 && (
            <span className="text-xs text-red-500">{invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} with same home/away team will be skipped</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 rounded bg-navy-900 text-white text-sm font-medium hover:bg-navy-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Creating…" : `Create ${rows.filter(r => r.home_team_id && r.away_team_id && r.home_team_id !== r.away_team_id).length || rows.length} fixture${rows.length !== 1 ? "s" : ""}`}
        </button>
        <a href="/admin/fixtures" className="text-sm text-slate-500 hover:underline">
          Cancel
        </a>
      </div>
    </form>
  );
}
