import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { createCoach } from "../actions";

export const dynamic = "force-dynamic";

const ROLES = [
  "Head Coach",
  "Assistant Coach",
  "Strength & Conditioning",
  "Skills Coach",
  "Other",
];

export default async function NewCoachPage() {
  const supabase = createAdminClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("team_id, name")
    .eq("team_type", "club")
    .neq("is_public", false)
    .order("name");

  return (
    <FormShell
      title="Add Coach"
      backHref="/admin/coaches"
      onSubmit={createCoach}
      submitLabel="Create coach"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" required />
        </Field>
        <Field label="Last name">
          <Input name="last_name" required />
        </Field>
      </div>

      <Field
        label="Club"
        hint="Only this club can name them on a team sheet. Leave blank and any club may."
      >
        <SearchableSelect
          name="team_id"
          emptyLabel="— any club —"
          defaultValue=""
          options={(teams ?? []).map((t: any) => ({
            value: t.team_id,
            label: t.name,
          }))}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Role">
          <Select name="role" defaultValue="Head Coach">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" hint="Inactive coaches cannot be named on new sheets.">
          <Select name="status" defaultValue="active">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </Select>
        </Field>
      </div>

      <Field label="Qualification">
        <Input name="qualification" placeholder="Level 2 / World Rugby Coaching" />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" />
        </Field>
        <Field label="Nationality">
          <Input name="nationality" placeholder="Ghanaian" />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone">
          <Input name="phone" type="tel" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" />
        </Field>
      </div>

      <PhotoUpload name="photo" label="Photo" shape="round" />
    </FormShell>
  );
}
