import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { updateTeam } from "../actions";

export default async function EditTeamPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: team }, { data: venues }] = await Promise.all([
    supabase.from("teams").select("*").eq("team_id", params.id).maybeSingle(),
    supabase.from("venues").select("venue_id, name").order("name"),
  ]);

  if (!team) notFound();
  const bound = updateTeam.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${team.name}`} backHref="/admin/teams" onSubmit={bound} submitLabel="Save changes">
      <Field label="Name">
        <Input name="name" required defaultValue={team.name} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" defaultValue={team.region ?? ""} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={team.city ?? ""} />
        </Field>
      </div>
      <Field label="Home venue">
        <Select name="home_venue_id" defaultValue={team.home_venue_id ?? ""}>
          <option value="">— select —</option>
          {(venues ?? []).map((v: any) => (
            <option key={v.venue_id} value={v.venue_id}>{v.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Manager">
          <Input name="manager_name" defaultValue={team.manager_name ?? ""} />
        </Field>
        <Field label="Coach">
          <Input name="coach_name" defaultValue={team.coach_name ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Founded year">
          <Input name="founded_year" type="number" min={1800} max={2100} defaultValue={team.founded_year ?? ""} />
        </Field>
        <Field label="Logo URL">
          <Input name="logo_url" defaultValue={team.logo_url ?? ""} />
        </Field>
      </div>
    </FormShell>
  );
}
