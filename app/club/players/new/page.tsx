import { requireClub } from "@/lib/auth";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { POSITIONS } from "@/lib/positions";
import { createClubPlayer } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewClubPlayerPage() {
  // Not for the data — to refuse anyone who is not a club before the form
  // is even drawn.
  await requireClub();

  return (
    <FormShell
      title="Add player"
      backHref="/club/players"
      onSubmit={createClubPlayer}
      submitLabel="Add to squad"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" required />
        </Field>
        <Field label="Last name">
          <Input name="last_name" required />
        </Field>
      </div>

      <PhotoUpload name="photo" label="Player photo" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Position">
          <Select name="position" defaultValue="">
            <option value="">— not set —</option>
            {POSITIONS.map((x) => (
              <option key={x} value={x}>{x}</option>
            ))}
          </Select>
        </Field>
        <Field label="Jersey number">
          <Input name="jersey_number" type="number" min={1} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Nationality">
          <Input name="nationality" placeholder="Ghanaian" />
        </Field>
        <Field label="Phone">
          <Input name="phone" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" />
        </Field>
      </div>

      <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-3">
        The player is added to your squad and sent to the federation for
        approval. You can fill in their details straight away; they appear on
        the public site once the federation has approved them.
      </p>
    </FormShell>
  );
}
