import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
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
        <Select name="competition_id" defaultValue={f.competition_id ?? ""}>
          <option value="">—</option>
          {(comps ?? []).map((c: any) => (
            <option key={c.competition_id} value={c.competition_id}>
              {c.name}{c.season ? ` · ${c.season}` : ""}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Home team">
          <Select name="home_team_id" required defaultValue={f.home_team_id ?? ""}>
            <option value="">— select —</option>
            {(teams ?? []).map((t: any) => (
              <option key={t.team_id} value={t.team_id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Away team">
          <Select name="away_team_id" required defaultValue={f.away_team_id ?? ""}>
            <option value="">— select —</option>
            {(teams ?? []).map((t: any) => (
              <option key={t.team_id} value={t.team_id}>{t.name}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Venue">
        <Select name="venue_id" defaultValue={f.venue_id ?? ""}>
          <option value="">—</option>
          {(venues ?? []).map((v: any) => (
            <option key={v.venue_id} value={v.venue_id}>{v.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-4">
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
    </FormShell>
  );
}
