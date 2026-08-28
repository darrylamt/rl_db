import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { UploadOrLink } from "@/components/admin/UploadOrLink";
import { createDocument } from "../actions";
import { DOCUMENT_TYPES } from "@/lib/contentTypes";

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
      <Field label="Document" hint="Upload the file, or link to one already hosted (Google Drive, etc.).">
        <UploadOrLink
          urlName="link"
          bucket="documents"
          prefix="files"
          kind="document"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
          urlPlaceholder="https://drive.google.com/file/d/.../view"
          
        />
      </Field>
      <Field label="Thumbnail" hint="Cover image shown on the documents page.">
        <UploadOrLink
          urlName="thumbnail_url"
          bucket="content-images"
          prefix="documents"
          accept="image/*"
          urlPlaceholder="/reports/2025.png"
          
        />
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
