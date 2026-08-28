import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Checkbox } from "@/components/admin/FormShell";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { createTeam } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTeamPage() {
  const supabase = createAdminClient();
  let venues: any[] = [];
  try {
    const { data } = await supabase
      .from("venues")
      .select("venue_id, name")
      .order("name");
    venues = data ?? [];
  } catch {
    // form still renders
  }

  return (
    <FormShell title="Add Team" backHref="/admin/teams" onSubmit={createTeam} submitLabel="Create team">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <Field label="Division" hint="Drives the men/women/youth toggle on the website">
          <Select name="division" defaultValue="men">
            <option value="men">Men</option>
            <option value="women">Women</option>
            <option value="youth">Youth</option>
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
          {venues.map((v: any) => (
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
      <Field label="Founded year">
        <Input name="founded_year" type="number" min={1800} max={2100} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="URL slug" hint="Public address on the website: /clubs/<slug>">
          <Input name="slug" placeholder="panthers" />
        </Field>
        <Field label="Legal name" hint="Registered name, if different from the playing name">
          <Input name="legal_name" />
        </Field>
      </div>
      <Field label="Instagram">
        <Input name="instagram_url" type="url" placeholder="https://instagram.com/…" />
      </Field>
      <Checkbox name="is_public" defaultChecked  label="Show this club on the public website" />
      <Field label="Club Logo">
        <PhotoUpload name="logo" label="Logo" shape="square" />
      </Field>
    </FormShell>
  );
}
