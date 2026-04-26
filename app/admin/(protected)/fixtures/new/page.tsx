import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { createFixture } from "../actions";

export const dynamic = "force-dynamic";

const STATUSES = ["scheduled","live","completed","postponed","cancelled"];

export default async function NewFixturePage() {
  const supabase = createAdminClient();
  let teams: any[] = [];
  let comps: any[] = [];
  let venues: any[] = [];
  try {
    const [t, c, v] = await Promise.all([
      supabase.from("teams").select("team_id, name").order("name"),
      supabase.from("competitions").select("competition_id, name, season").order("name"),
      supabase.from("venues").select("venue_id, name").order("name"),
    ]);
    teams = t.data ?? [];
    comps = c.data ?? [];
    venues = v.data ?? [];
  } catch {
    // data stays as empty arrays — form still renders
  }

  return (
    <FormShell title="Add Fixture" backHref="/admin/fixtures" onSubmit={createFixture} submitLabel="Create fixture">
      <Field label="Competition">
        <Select name="competition_id" defaultValue="">
          <option value="">—</option>
          {comps.map((c: any) => (
            <option key={c.competition_id} value={c.competition_id}>
              {c.name}{c.season ? ` · ${c.season}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Home team">
          <Select name="home_team_id" required defaultValue="">
            <option value="">— select —</option>
            {teams.map((t: any) => (
              <option key={t.team_id} value={t.team_id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Away team">
          <Select name="away_team_id" required defaultValue="">
            <option value="">— select —</option>
            {teams.map((t: any) => (
              <option key={t.team_id} value={t.team_id}>{t.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Venue">
        <Select name="venue_id" defaultValue="">
          <option value="">—</option>
          {venues.map((v: any) => (
            <option key={v.venue_id} value={v.venue_id}>{v.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Date">
          <Input name="scheduled_date" type="date" />
        </Field>
        <Field label="Time">
          <Input name="scheduled_time" type="time" />
        </Field>
        <Field label="Round">
          <Input name="round" placeholder="R1 / QF / Final" />
        </Field>
      </div>
      <Field label="Status">
        <Select name="status" defaultValue="scheduled">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>
    </FormShell>
  );
}
