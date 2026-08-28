import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { UploadOrLink } from "@/components/admin/UploadOrLink";
import { updatePerson } from "../actions";

export default async function EditPersonPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: p } = await supabase
    .from("people")
    .select("*")
    .eq("person_id", params.id)
    .maybeSingle();
  if (!p) notFound();

  const bound = updatePerson.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${p.name}`} backHref="/admin/people" onSubmit={bound} submitLabel="Save changes">
      <Field label="Name">
        <Input name="name" required defaultValue={p.name} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Role" hint="Shown under the name, e.g. President">
          <Input name="role" defaultValue={p.role ?? ""} />
        </Field>
        <Field label="Group">
          <Select name="group_name" defaultValue={p.group_name ?? "board"}>
            <option value="board">board</option>
            <option value="committee">committee</option>
          </Select>
        </Field>
      </div>
      <Field label="Email">
        <Input name="email" type="email" defaultValue={p.email ?? ""} />
      </Field>
      <Field label="Photo" hint="Headshot shown on the about and governance pages.">
        <UploadOrLink
          urlName="photo_url"
          bucket="content-images"
          prefix="people"
          accept="image/*"
          urlPlaceholder="/team/12.png"
          currentUrl={p.photo_url}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Sort order" hint="Lower shows first">
          <Input name="sort_order" type="number" defaultValue={p.sort_order ?? 0} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={p.status ?? "active"}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </Select>
        </Field>
      </div>
    </FormShell>
  );
}
