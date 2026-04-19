import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell, Field, Input } from "@/components/admin/FormShell";
import { updateVenue } from "../actions";

export default async function EditVenuePage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const { data: v } = await supabase.from("venues").select("*").eq("venue_id", params.id).maybeSingle();
  if (!v) notFound();
  const bound = updateVenue.bind(null, params.id);

  return (
    <FormShell title={`Edit: ${v.name}`} backHref="/admin/venues" onSubmit={bound} submitLabel="Save changes">
      <Field label="Name">
        <Input name="name" required defaultValue={v.name} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" defaultValue={v.region ?? ""} />
        </Field>
        <Field label="City">
          <Input name="city" defaultValue={v.city ?? ""} />
        </Field>
      </div>
      <Field label="Capacity">
        <Input name="capacity" type="number" min={0} defaultValue={v.capacity ?? ""} />
      </Field>
    </FormShell>
  );
}
