import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { MatchOfficialsFields } from "@/components/admin/MatchOfficialsFields";
import { MatchCoachesFields } from "@/components/admin/MatchCoachesFields";
import { updateFixture } from "../actions";

const STATUSES = ["scheduled","live","completed","postponed","cancelled"];

export default async function EditFixturePage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [
    { data: f },
    { data: teams },
    { data: comps },
    { data: venues },
    { data: officials },
    { data: onTheGame },
    { data: coaches },
    { data: sheets },
  ] = await Promise.all([
    supabase.from("fixtures").select("*").eq("fixture_id", params.id).maybeSingle(),
    supabase.from("teams").select("team_id, name").order("name"),
    supabase.from("competitions").select("competition_id, name, season").order("name"),
    supabase.from("venues").select("venue_id, name").order("name"),
    supabase
      .from("officials")
      .select("official_id, first_name, last_name, role, status")
      .order("last_name"),
    supabase
      .from("fixture_officials")
      .select("role, official_id")
      .eq("fixture_id", params.id),
    // Both sides' options in one read; the fieldset narrows each list to the
    // club it belongs to. Empty until supabase/coaches.sql has been run.
    supabase
      .from("coaches")
      .select("coach_id, first_name, last_name, role, team_id, status")
      .eq("status", "active")
      .order("last_name"),
    supabase
      .from("team_sheets")
      .select("team_id, head_coach_id, assistant_coach_id")
      .eq("fixture_id", params.id),
  ]);
  if (!f) notFound();

  // Retired officials stay on a match they already did, so the field can show
  // them; they are simply not offered for a new appointment.
  const alreadyOn = new Set((onTheGame ?? []).map((r: any) => r.official_id));
  const available = (officials ?? []).filter(
    (o: any) => o.status !== "inactive" || alreadyOn.has(o.official_id),
  );
  const current: Record<string, string> = {};
  for (const r of (onTheGame ?? []) as any[]) current[r.role] = r.official_id;

  // Whichever side each stored sheet belongs to, keyed the way the fields are
  // named so the form can find them.
  const dugouts: Record<string, string> = {};
  for (const r of (sheets ?? []) as any[]) {
    const key = r.team_id === f.home_team_id ? "home" : "away";
    if (r.head_coach_id) dugouts[`${key}_head_coach_id`] = r.head_coach_id;
    if (r.assistant_coach_id) {
      dugouts[`${key}_assistant_coach_id`] = r.assistant_coach_id;
    }
  }

  const nameOfTeam = (id: string | null) =>
    (teams ?? []).find((t: any) => t.team_id === id)?.name ?? "";
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
      <MatchOfficialsFields officials={available as any} current={current} />

      <MatchCoachesFields
        coaches={(coaches ?? []) as any}
        sides={[
          { key: "home", teamId: f.home_team_id ?? null, name: nameOfTeam(f.home_team_id) },
          { key: "away", teamId: f.away_team_id ?? null, name: nameOfTeam(f.away_team_id) },
        ]}
        current={dugouts}
      />

      <Field label="URL slug" hint="Public address on the website. Leave blank to keep the generated one.">
        <Input name="slug" placeholder="bulls-nungua-tigers-28-01-24" defaultValue={f.slug ?? ""} />
      </Field>

    </FormShell>
  );
}
