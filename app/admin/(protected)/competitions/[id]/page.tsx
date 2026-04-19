import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input, Select } from "@/components/admin/FormShell";
import { updateCompetition } from "../actions";

const TYPES = ["League","Cup","Tournament","Friendly","International"];
const STATUSES = ["upcoming","active","completed","cancelled"];

export default async function EditCompetitionPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: c } = await supabase.from("competitions").select("*").eq("competition_id", params.id).maybeSingle();
  if (!c) notFound();
  const bound = updateCompetition.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${c.name}`} backHref="/admin/competitions" onSubmit={bound} submitLabel="Save changes">
      <Field label="Name">
        <Input name="name" required defaultValue={c.name} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Season">
          <Input name="season" defaultValue={c.season ?? ""} />
        </Field>
        <Field label="Type">
          <Select name="type" defaultValue={c.type ?? ""}>
            <option value="">—</option>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={c.status ?? "upcoming"}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Start date">
          <Input name="start_date" type="date" defaultValue={c.start_date ?? ""} />
        </Field>
        <Field label="End date">
          <Input name="end_date" type="date" defaultValue={c.end_date ?? ""} />
        </Field>
      </div>
    </FormShell>
  );
}
