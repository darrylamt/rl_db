import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { createPerson } from "../actions";

export default function NewPersonPage() {
  return (
    <FormShell title="Add Person" backHref="/admin/people" onSubmit={createPerson} submitLabel="Add person">
      <Field label="Name">
        <Input name="name" required placeholder="Juliana Storey" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Role" hint="Shown under the name, e.g. President">
          <Input name="role" placeholder="President" />
        </Field>
        <Field label="Group">
          <Select name="group_name" defaultValue="board">
            <option value="board">board</option>
            <option value="committee">committee</option>
          </Select>
        </Field>
      </div>
      <Field label="Email">
        <Input name="email" type="email" />
      </Field>
      <Field label="Photo" hint="Path or URL, e.g. /team/12.png">
        <Input name="photo_url" placeholder="/team/12.png" />
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
