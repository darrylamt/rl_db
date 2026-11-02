import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { FormShell } from "@/components/admin/FormShell";
import { updateEvent } from "../actions";
import { EventFields } from "../EventFields";

export const dynamic = "force-dynamic";

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const { data: event } = await createAdminClient()
    .from("federation_events")
    .select("*")
    .eq("event_id", params.id)
    .maybeSingle();
  if (!event) notFound();

  return (
    <FormShell title={`Edit: ${event.title}`} backHref="/admin/events" onSubmit={updateEvent.bind(null, params.id)} submitLabel="Save changes">
      <EventFields event={event} />
    </FormShell>
  );
}
