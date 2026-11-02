import { FormShell } from "@/components/admin/FormShell";
import { createEvent } from "../actions";
import { EventFields } from "../EventFields";

export default function NewEventPage() {
  return (
    <FormShell title="Add Event" backHref="/admin/events" onSubmit={createEvent} submitLabel="Add event">
      <EventFields />
    </FormShell>
  );
}
