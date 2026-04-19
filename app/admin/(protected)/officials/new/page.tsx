import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { createOfficial } from "../actions";

const ROLES = ["Referee","Touch judge","Video referee","Match commissioner","Timekeeper","Other"];
const STATUSES = ["active","inactive","retired"];

export default function NewOfficialPage() {
  return (
    <FormShell title="Add Official" backHref="/admin/officials" onSubmit={createOfficial} submitLabel="Create official">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name">
          <Input name="first_name" required />
        </Field>
        <Field label="Last name">
          <Input name="last_name" required />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Role">
          <Select name="role" defaultValue="">
            <option value="">—</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="active">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" />
        </Field>
        <Field label="Nationality">
          <Input name="nationality" placeholder="Ghanaian" />
        </Field>
      </div>
      <Field label="Date of birth">
        <Input name="date_of_birth" type="date" />
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
    </FormShell>
  );
}
