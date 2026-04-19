import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { createTeam } from "../actions";

export default async function NewTeamPage() {
  const supabase = createAdminClient();
  const { data: venues } = await supabase
    .from("venues")
    .select("venue_id, name")
    .order("name");

  return (
    <FormShell title="Add Team" backHref="/admin/teams" onSubmit={createTeam} submitLabel="Create team">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name">
          <Input name="name" required placeholder="e.g. Accra Panthers" />
        </Field>
        <Field label="Type">
          <Select name="team_type" defaultValue="club">
            <option value="club">Club</option>
            <option value="national">National</option>
            <option value="president_xv">President XIII</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" placeholder="Greater Accra" />
        </Field>
        <Field label="City">
          <Input name="city" placeholder="Accra" />
        </Field>
      </div>
      <Field label="Home venue">
        <Select name="home_venue_id" defaultValue="">
          <option value="">— select —</option>
          {(venues ?? []).map((v: any) => (
            <option key={v.venue_id} value={v.venue_id}>{v.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Manager">
          <Input name="manager_name" />
        </Field>
        <Field label="Coach">
          <Input name="coach_name" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Founded year">
          <Input name="founded_year" type="number" min={1800} max={2100} />
        </Field>
        <Field label="Logo URL">
          <Input name="logo_url" placeholder="https://..." />
        </Field>
      </div>
    </FormShell>
  );
}
