import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { createPartner } from "../actions";

export default function NewPartnerPage() {
  return (
    <FormShell title="Add Partner" backHref="/admin/partners" onSubmit={createPartner} submitLabel="Add partner">
      <Field label="Name">
        <Input name="name" required placeholder="Polytank Ghana Limited" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tier">
          <Select name="tier" defaultValue="1">
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
          </Select>
        </Field>
        <Field label="Tier heading" hint="Editable copy, e.g. Official Partners">
          <Input name="tier_title" placeholder="Official Partners" />
        </Field>
      </div>
      <Field label="Designation" hint="Optional line under the logo">
        <Input name="designation" />
      </Field>
      <Field label="Website">
        <Input name="link" type="url" />
      </Field>
      <Field label="Logo" hint="Path or URL, e.g. /partners/polytank.png">
        <Input name="logo_url" placeholder="/partners/polytank.png" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Sort order" hint="Lower shows first">
          <Input name="sort_order" type="number" defaultValue={0} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="active">
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </Select>
        </Field>
      </div>
    </FormShell>
  );
}
