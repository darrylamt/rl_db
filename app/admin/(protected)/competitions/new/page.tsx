import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { createCompetition } from "../actions";

const TYPES = ["League","Cup","Tournament","Friendly","International"];
const STATUSES = ["upcoming","active","completed","cancelled"];

export default function NewCompetitionPage() {
  return (
    <FormShell title="Add Competition" backHref="/admin/competitions" onSubmit={createCompetition} submitLabel="Create competition">
      <Field label="Name">
        <Input name="name" required placeholder="Ghana Rugby League Championship" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Season">
          <Input name="season" placeholder="2026" />
        </Field>
        <Field label="Type">
          <Select name="type" defaultValue="">
            <option value="">—</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue="upcoming">
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Start date">
          <Input name="start_date" type="date" />
        </Field>
        <Field label="End date">
          <Input name="end_date" type="date" />
        </Field>
      </div>
      <Field label="URL slug" hint="Public address on the website: /competitions/<slug>">
        <Input name="slug" placeholder="mens-13s-championship" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Logo" hint="Path or URL, e.g. /competitions/m13c.png">
          <Input name="logo_url" />
        </Field>
        <Field label="Banner" hint="Wide image for the competition header">
          <Input name="banner_url" />
        </Field>
      </div>

    </FormShell>
  );
}
