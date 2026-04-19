import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Checkbox } from "@/components/admin/FormShell";
import { createPlayer } from "../actions";

const POSITIONS = [
  "Fullback","Wing","Centre","Stand-off","Scrum-half",
  "Prop","Hooker","Second-row","Loose forward","Utility",
];
const STATUSES = ["active","injured","suspended","retired","inactive"];

export default async function NewPlayerPage() {
  const supabase = createAdminClient();
  const { data: teams } = await supabase.from("teams").select("team_id, name").order("name");

  return (
    <FormShell title="Add Player" backHref="/admin/players" onSubmit={createPlayer} submitLabel="Create player">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" required />
        </Field>
        <Field label="Last name">
          <Input name="last_name" required />
        </Field>
      </div>
      <Field label="Team">
        <Select name="team_id" defaultValue="">
          <option value="">— unassigned —</option>
          {(teams ?? []).map((t: any) => (
            <option key={t.team_id} value={t.team_id}>{t.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Jersey #">
          <Input name="jersey_number" type="number" min={0} max={99} />
        </Field>
        <Field label="Position">
          <Select name="position" defaultValue="">
            <option value="">—</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="playing_status" defaultValue="active">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Date of birth">
          <Input name="date_of_birth" type="date" />
        </Field>
        <Field label="Height (cm)">
          <Input name="height_cm" type="number" min={0} />
        </Field>
        <Field label="Weight (kg)">
          <Input name="weight_kg" type="number" min={0} />
        </Field>
      </div>
      <Field label="Nationality">
        <Input name="nationality" placeholder="Ghanaian" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone">
          <Input name="phone" type="tel" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" />
        </Field>
      </div>
      <Field label="Photo URL">
        <Input name="photo_url" placeholder="https://..." />
      </Field>
      <Checkbox name="is_captain" label="Team captain" />
    </FormShell>
  );
}
