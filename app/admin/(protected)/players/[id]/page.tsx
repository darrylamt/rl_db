import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Checkbox } from "@/components/admin/FormShell";
import { updatePlayer } from "../actions";

const POSITIONS = [
  "Fullback","Wing","Centre","Stand-off","Scrum-half",
  "Prop","Hooker","Second-row","Loose forward","Utility",
];
const STATUSES = ["active","injured","suspended","retired","inactive"];

export default async function EditPlayerPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: p }, { data: teams }] = await Promise.all([
    supabase.from("players").select("*").eq("player_id", params.id).maybeSingle(),
    supabase.from("teams").select("team_id, name").order("name"),
  ]);
  if (!p) notFound();
  const bound = updatePlayer.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${p.first_name} ${p.last_name}`} backHref="/admin/players" onSubmit={bound} submitLabel="Save changes">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" required defaultValue={p.first_name} />
        </Field>
        <Field label="Last name">
          <Input name="last_name" required defaultValue={p.last_name} />
        </Field>
      </div>
      <Field label="Team">
        <Select name="team_id" defaultValue={p.team_id ?? ""}>
          <option value="">— unassigned —</option>
          {(teams ?? []).map((t: any) => (
            <option key={t.team_id} value={t.team_id}>{t.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Jersey #">
          <Input name="jersey_number" type="number" min={0} max={99} defaultValue={p.jersey_number ?? ""} />
        </Field>
        <Field label="Position">
          <Select name="position" defaultValue={p.position ?? ""}>
            <option value="">—</option>
            {POSITIONS.map(x => <option key={x} value={x}>{x}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="playing_status" defaultValue={p.playing_status ?? "active"}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Date of birth">
          <Input name="date_of_birth" type="date" defaultValue={p.date_of_birth ?? ""} />
        </Field>
        <Field label="Height (cm)">
          <Input name="height_cm" type="number" min={0} defaultValue={p.height_cm ?? ""} />
        </Field>
        <Field label="Weight (kg)">
          <Input name="weight_kg" type="number" min={0} defaultValue={p.weight_kg ?? ""} />
        </Field>
      </div>
      <Field label="Nationality">
        <Input name="nationality" defaultValue={p.nationality ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={p.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={p.email ?? ""} />
        </Field>
      </div>
      <Field label="Photo URL">
        <Input name="photo_url" defaultValue={p.photo_url ?? ""} />
      </Field>
      <Checkbox name="is_captain" defaultChecked={!!p.is_captain} label="Team captain" />
    </FormShell>
  );
}
