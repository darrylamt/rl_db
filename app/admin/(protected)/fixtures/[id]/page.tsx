import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { updateFixture } from "../actions";

const STATUSES = ["scheduled","live","completed","postponed","cancelled"];

export default async function EditFixturePage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: f }, { data: teams }, { data: comps }, { data: venues }] = await Promise.all([
    supabase.from("fixtures").select("*").eq("fixture_id", params.id).maybeSingle(),
    supabase.from("teams").select("team_id, name").order("name"),
    supabase.from("competitions").select("competition_id, name, season").order("name"),
    supabase.from("venues").select("venue_id, name").order("name"),
  ]);
  if (!f) notFound();
  const bound = updateFixture.bind(null, params.id);

  return (
    <FormShell title="Edit Fixture" backHref="/admin/fixtures" onSubmit={bound} submitLabel="Save changes">
      <Field label="Competition">
        <SearchableSelect
          name="competition_id"
          defaultValue={f.competition_id ?? ""}
          options={(comps ?? []).map((c: any) => ({
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
            defaultValue={f.home_team_id ?? ""}
            options={(teams ?? []).map((t: any) => ({ value: t.team_id, label: t.name }))}
          />
        </Field>
        <Field label="Away team">
          <SearchableSelect
            name="away_team_id"
            required
            emptyLabel="— select —"
            defaultValue={f.away_team_id ?? ""}
            options={(teams ?? []).map((t: any) => ({ value: t.team_id, label: t.name }))}
          />
        </Field>
      </div>
      <Field label="Venue">
        <SearchableSelect
          name="venue_id"
          defaultValue={f.venue_id ?? ""}
          options={(venues ?? []).map((v: any) => ({ value: v.venue_id, label: v.name }))}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Date">
          <Input name="scheduled_date" type="date" defaultValue={f.scheduled_date ?? ""} />
        </Field>
        <Field label="Time">
          <Input name="scheduled_time" type="time" defaultValue={f.scheduled_time?.slice(0,5) ?? ""} />
        </Field>
        <Field label="Round">
          <Input name="round" defaultValue={f.round ?? ""} />
        </Field>
      </div>
      <Field label="Status">
        <Select name="status" defaultValue={f.status ?? "scheduled"}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>
      <Field label="URL slug" hint="Public address on the website. Leave blank to keep the generated one.">
        <Input name="slug" placeholder="bulls-nungua-tigers-28-01-24" defaultValue={f.slug ?? ""} />
      </Field>

    </FormShell>
  );
}
