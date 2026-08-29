import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
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
        <SearchableSelect
          name="competition_id"
          defaultValue={""}
          options={comps.map((c: any) => ({
            value: c.competition_id,
            label: c.name,
            hint: c.season ?? undefined,
          }))}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Home team">
          <SearchableSelect
            name="home_team_id"
            required
            emptyLabel="— select —"
            defaultValue={""}
            options={teams.map((t: any) => ({ value: t.team_id, label: t.name }))}
          />
        </Field>
        <Field label="Away team">
          <SearchableSelect
            name="away_team_id"
            required
            emptyLabel="— select —"
            defaultValue={""}
            options={teams.map((t: any) => ({ value: t.team_id, label: t.name }))}
          />
        </Field>
      </div>
      <Field label="Venue">
        <SearchableSelect
          name="venue_id"
          defaultValue={""}
          options={venues.map((v: any) => ({ value: v.venue_id, label: v.name }))}
        />
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
      <Field label="URL slug" hint="Public address on the website. Leave blank to keep the generated one.">
        <Input name="slug" placeholder="bulls-nungua-tigers-28-01-24" />
      </Field>

    </FormShell>
  );
}
