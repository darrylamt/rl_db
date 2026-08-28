import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { createDocument, DOCUMENT_TYPES } from "../actions";

export default function NewDocumentPage() {
  return (
    <FormShell title="Add Document" backHref="/admin/documents" onSubmit={createDocument} submitLabel="Add document">
      <Field label="Name">
        <Input name="name" required placeholder="2025 Annual Report" />
      </Field>
      <Field label="Type">
        <Select name="type" defaultValue="Reports">
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      <Field label="Link" hint="Google Drive or any public URL. Opens in a new tab on the website.">
        <Input name="link" type="url" placeholder="https://drive.google.com/file/d/.../view" />
      </Field>
      <Field label="Thumbnail" hint="Path or URL to the cover image, e.g. /reports/2025.png">
        <Input name="thumbnail_url" placeholder="/reports/2025.png" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Published">
          <Input name="published_at" type="date" />
        </Field>
        <Field label="Sort order" hint="Lower shows first">
          <Input name="sort_order" type="number" defaultValue={0} />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="published">
            <option value="published">published</option>
            <option value="archived">archived</option>
          </Select>
        </Field>
      </div>
    </FormShell>
  );
}
