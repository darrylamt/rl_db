import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { updateCoach } from "../actions";

export const dynamic = "force-dynamic";

const ROLES = [
  "Head Coach",
  "Assistant Coach",
  "Strength & Conditioning",
  "Skills Coach",
  "Other",
];

export default async function EditCoachPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();
  const [{ data: c }, { data: teams }, { count: sheets }] = await Promise.all([
    supabase.from("coaches").select("*").eq("coach_id", params.id).maybeSingle(),
    supabase
      .from("teams")
      .select("team_id, name")
      .eq("team_type", "club")
      .neq("is_public", false)
      .order("name"),
    supabase
      .from("team_sheets")
      .select("sheet_id", { count: "exact", head: true })
      .or(`head_coach_id.eq.${params.id},assistant_coach_id.eq.${params.id}`),
  ]);
  if (!c) notFound();

  const bound = updateCoach.bind(null, params.id);

  return (
    <FormShell
      title="Edit Coach"
      backHref="/admin/coaches"
      onSubmit={bound}
      submitLabel="Save changes"
    >
      {(sheets ?? 0) > 0 && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded px-3 py-2">
          Named on {sheets} team sheet{sheets === 1 ? "" : "s"}. Moving them to
          another club does not change matches they have already coached.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" required defaultValue={c.first_name ?? ""} />
        </Field>
        <Field label="Last name">
          <Input name="last_name" required defaultValue={c.last_name ?? ""} />
        </Field>
      </div>

      <Field
        label="Club"
        hint="Only this club can name them on a team sheet. Leave blank and any club may."
      >
        <SearchableSelect
          name="team_id"
          emptyLabel="— any club —"
          defaultValue={c.team_id ?? ""}
          options={(teams ?? []).map((t: any) => ({
            value: t.team_id,
            label: t.name,
          }))}
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Role">
          <Select name="role" defaultValue={c.role ?? "Head Coach"}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" hint="Inactive coaches cannot be named on new sheets.">
          <Select name="status" defaultValue={c.status ?? "active"}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </Select>
        </Field>
      </div>

      <Field label="Qualification">
        <Input
          name="qualification"
          defaultValue={c.qualification ?? ""}
          placeholder="Level 2 / World Rugby Coaching"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" defaultValue={c.region ?? ""} />
        </Field>
        <Field label="Nationality">
          <Input name="nationality" defaultValue={c.nationality ?? ""} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={c.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={c.email ?? ""} />
        </Field>
      </div>

      <Field label="Photo URL">
        <Input name="photo_url" defaultValue={c.photo_url ?? ""} />
      </Field>
    </FormShell>
  );
}
