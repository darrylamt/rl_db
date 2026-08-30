import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClub } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { POSITIONS } from "@/lib/positions";
import { updateClubPlayer } from "../actions";

export const dynamic = "force-dynamic";

export default async function ClubPlayerPage({
  params,
}: {
  params: { id: string };
}) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();

  const { data: p } = await supabase
    .from("players")
    .select("*")
    .eq("player_id", params.id)
    .maybeSingle();

  // A player from another club is not "forbidden" here so much as not yours
  // to see — treat it as missing rather than confirming it exists.
  if (!p || p.team_id !== teamId) notFound();

  const bound = updateClubPlayer.bind(null, params.id);

  return (
    <FormShell
      title={`${p.first_name} ${p.last_name}`}
      backHref="/club/players"
      onSubmit={bound}
      submitLabel="Save changes"
    >
      <PhotoUpload name="photo" currentUrl={p.photo_url} label="Player photo" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Position">
          <Select name="position" defaultValue={p.position ?? ""}>
            <option value="">— not set —</option>
            {POSITIONS.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <Field label="Jersey number">
          <Input name="jersey_number" type="number" min={1} defaultValue={p.jersey_number ?? ""} />
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Nationality">
          <Input name="nationality" defaultValue={p.nationality ?? ""} placeholder="Ghanaian" />
        </Field>
        <Field label="Phone">
          <Input name="phone" defaultValue={p.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={p.email ?? ""} />
        </Field>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-navy-900">
        <input
          type="checkbox"
          name="is_captain"
          defaultChecked={!!p.is_captain}
          className="h-4 w-4 rounded border-slate-400"
        />
        Club captain
      </label>

      {/* What a club cannot change, said plainly rather than left to be
          discovered by a field that will not save. */}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-600">Held by the federation</p>
        <p>
          Registration status{p.playing_status ? ` (currently ${p.playing_status})` : ""},
          which club the player belongs to, and scouting attributes. Ask the
          federation if any of these need changing.
        </p>
        <p>
          <Link href="/club/players" className="text-navy-700 hover:underline">
            ← Back to squad
          </Link>
        </p>
      </div>
    </FormShell>
  );
}
