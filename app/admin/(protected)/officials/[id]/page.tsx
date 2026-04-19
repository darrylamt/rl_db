import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { updateOfficial } from "../actions";

const ROLES = ["Referee","Touch judge","Video referee","Match commissioner","Timekeeper","Other"];
const STATUSES = ["active","inactive","retired"];

export default async function EditOfficialPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: o } = await supabase.from("officials").select("*").eq("official_id", params.id).maybeSingle();
  if (!o) notFound();
  const bound = updateOfficial.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${o.first_name} ${o.last_name}`} backHref="/admin/officials" onSubmit={bound} submitLabel="Save changes">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" required defaultValue={o.first_name} />
        </Field>
        <Field label="Last name">
          <Input name="last_name" required defaultValue={o.last_name} />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Role">
          <Select name="role" defaultValue={o.role ?? ""}>
            <option value="">—</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={o.status ?? "active"}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" defaultValue={o.region ?? ""} />
        </Field>
        <Field label="Nationality">
          <Input name="nationality" defaultValue={o.nationality ?? ""} />
        </Field>
      </div>
      <Field label="Date of birth">
        <Input name="date_of_birth" type="date" defaultValue={o.date_of_birth ?? ""} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Phone">
          <Input name="phone" type="tel" defaultValue={o.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={o.email ?? ""} />
        </Field>
      </div>
      <Field label="Photo URL">
        <Input name="photo_url" defaultValue={o.photo_url ?? ""} />
      </Field>
    </FormShell>
  );
}
