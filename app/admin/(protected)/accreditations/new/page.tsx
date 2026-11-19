import { FormShell } from "@/components/admin/FormShell";
import { createAdminClient } from "@/lib/supabase/server";
import { createAccreditation } from "../actions";
import { AccreditationFields } from "../AccreditationFields";

export const dynamic = "force-dynamic";

/** Add someone who needs a pass: team staff, media, volunteers. */
export default async function NewAccreditationPage() {
  const { data: teams } = await createAdminClient().from("teams").select("team_id, name").order("name");
  return (
    <FormShell title="Add someone for an ID card" backHref="/admin/id-cards?kind=staff" onSubmit={createAccreditation} submitLabel="Add">
      <AccreditationFields teams={(teams ?? []) as any[]} />
    </FormShell>
  );
}
