import { Field, Input, Select, Textarea } from "@/components/admin/FormShell";
import { UploadOrLink } from "@/components/admin/UploadOrLink";

export const EVENT_CATEGORIES = [
  { value: "tournament", label: "Tournament" },
  { value: "clinic", label: "Clinic / training" },
  { value: "meeting", label: "Meeting / AGM" },
  { value: "launch", label: "Launch" },
  { value: "social", label: "Social / community" },
  { value: "other", label: "Other" },
];

/** The fields for adding or editing an event; shared by both forms. */
export function EventFields({ event }: { event?: any }) {
  const e = event ?? {};
  return (
    <>
      <Field label="Title">
        <Input name="title" required defaultValue={e.title ?? ""} placeholder="Friday Night Footy Finals" />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Type">
          <Select name="category" defaultValue={e.category ?? "tournament"}>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Status" hint="Drafts stay here; cancelled events show on the site marked cancelled.">
          <Select name="status" defaultValue={e.status ?? "published"}>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Date">
          <Input name="starts_on" type="date" required defaultValue={e.starts_on ?? ""} />
        </Field>
        <Field label="Start time" hint="Optional">
          <Input name="start_time" type="time" defaultValue={e.start_time ? String(e.start_time).slice(0, 5) : ""} />
        </Field>
        <Field label="Ends on" hint="Only for events over several days">
          <Input name="ends_on" type="date" defaultValue={e.ends_on ?? ""} />
        </Field>
      </div>
      <Field label="Venue">
        <Input name="venue" defaultValue={e.venue ?? ""} placeholder="University of Ghana Rugby Stadium" />
      </Field>
      <Field label="Summary" hint="One or two lines, shown on the events list and the homepage.">
        <Textarea name="summary" rows={2} defaultValue={e.summary ?? ""} />
      </Field>
      <Field label="Details" hint="Everything else: programme, who it's for, what to bring.">
        <Textarea name="details" rows={6} defaultValue={e.details ?? ""} />
      </Field>
      <Field label="Link" hint="Registration, tickets or more information. Optional.">
        <Input name="link" type="url" defaultValue={e.link ?? ""} placeholder="https://…" />
      </Field>
      <Field label="Image" hint="A poster or photo. Shown on the event's page and its card.">
        <UploadOrLink urlName="image_url" bucket="content-images" prefix="events" currentUrl={e.image_url ?? null} accept="image/*" />
      </Field>
    </>
  );
}
