import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select, Checkbox } from "@/components/admin/FormShell";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { updatePlayer } from "../actions";

const POSITIONS = [
  "Fullback","Wing","Centre","Stand-off","Scrum-half",
  "Prop","Hooker","Second-row","Loose forward","Utility",
];
const STATUSES = ["active","injured","suspended","retired","inactive"];

export default async function EditPlayerPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: p }, { data: clubs }] = await Promise.all([
    supabase.from("players").select("*").eq("player_id", params.id).maybeSingle(),
    supabase
      .from("teams")
      .select("team_id, name, team_type")
      .eq("team_type", "club")
      .order("name"),
  ]);
  if (!p) notFound();

  let currentNonClub: { team_id: string; name: string } | null = null;
  if (p.team_id && !(clubs ?? []).some((t: any) => t.team_id === p.team_id)) {
    const { data } = await supabase
      .from("teams")
      .select("team_id, name")
      .eq("team_id", p.team_id)
      .maybeSingle();
    if (data) currentNonClub = data;
  }

  const bound = updatePlayer.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${p.first_name} ${p.last_name}`} backHref="/admin/players" onSubmit={bound} submitLabel="Save changes">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" required defaultValue={p.first_name} />
        </Field>
        <Field label="Last name">
          <Input name="last_name" required defaultValue={p.last_name} />
        </Field>
      </div>
      <Field label="Club">
        <Select name="team_id" defaultValue={p.team_id ?? ""}>
          <option value="">— unassigned —</option>
          {currentNonClub && (
            <option value={currentNonClub.team_id}>
              {currentNonClub.name} (non-club, current)
            </option>
          )}
          {(clubs ?? []).map((t: any) => (
            <option key={t.team_id} value={t.team_id}>{t.name}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <Select name="playing_status" defaultValue={p.playing_status ?? "inactive"}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={p.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={p.email ?? ""} />
        </Field>
      </div>
      <Field label="Player Photo">
        <PhotoUpload name="photo" currentUrl={p.photo_url} label="Photo" shape="round" />
      </Field>
      <Checkbox name="is_captain" defaultChecked={!!p.is_captain} label="Team captain" />
    </FormShell>
  );
}
