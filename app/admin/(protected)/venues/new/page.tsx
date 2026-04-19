import { FormShell, Field, Input } from "@/components/admin/FormShell";
import { createVenue } from "../actions";

export default function NewVenuePage() {
  return (
    <FormShell title="Add Venue" backHref="/admin/venues" onSubmit={createVenue} submitLabel="Create venue">
      <Field label="Name">
        <Input name="name" required placeholder="e.g. El-Wak Stadium" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Region">
          <Input name="region" placeholder="Greater Accra" />
        </Field>
        <Field label="City">
          <Input name="city" placeholder="Accra" />
        </Field>
      </div>
      <Field label="Capacity">
        <Input name="capacity" type="number" min={0} placeholder="e.g. 7500" />
      </Field>
    </FormShell>
  );
}
