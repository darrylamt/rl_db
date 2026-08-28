import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { updateDocument } from "../actions";
import { DOCUMENT_TYPES } from "@/lib/contentTypes";

export default async function EditDocumentPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: d } = await supabase
    .from("documents")
    .select("*")
    .eq("document_id", params.id)
    .maybeSingle();
  if (!d) notFound();

  const bound = updateDocument.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${d.name}`} backHref="/admin/documents" onSubmit={bound} submitLabel="Save changes">
      <Field label="Name">
        <Input name="name" required defaultValue={d.name} />
      </Field>
      <Field label="Type">
        <Select name="type" defaultValue={d.type}>
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      <Field label="Link" hint="Google Drive or any public URL. Opens in a new tab on the website.">
        <Input name="link" type="url" defaultValue={d.link ?? ""} />
      </Field>
      <Field label="Thumbnail" hint="Path or URL to the cover image, e.g. /reports/2025.png">
        <Input name="thumbnail_url" defaultValue={d.thumbnail_url ?? ""} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Published">
          <Input name="published_at" type="date" defaultValue={d.published_at ?? ""} />
        </Field>
        <Field label="Sort order" hint="Lower shows first">
          <Input name="sort_order" type="number" defaultValue={d.sort_order ?? 0} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={d.status ?? "published"}>
            <option value="published">published</option>
            <option value="archived">archived</option>
          </Select>
        </Field>
      </div>
    </FormShell>
  );
}
