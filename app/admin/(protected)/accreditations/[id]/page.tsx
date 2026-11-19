import Link from "next/link";
import { notFound } from "next/navigation";
import { FormShell } from "@/components/admin/FormShell";
import { createAdminClient } from "@/lib/supabase/server";
import { updateAccreditation } from "../actions";
import { AccreditationFields } from "../AccreditationFields";

export const dynamic = "force-dynamic";

export default async function EditAccreditationPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: a }, { data: teams }] = await Promise.all([
    supabase.from("accreditations").select("*").eq("accreditation_id", params.id).maybeSingle(),
    supabase.from("teams").select("team_id, name").order("name"),
  ]);
  if (!a) notFound();
  return (
    <div>
      <div className="px-4 md:px-8 pt-4 md:pt-8 -mb-2">
        <Link href={`/admin/id-cards/staff/${a.accreditation_id}`} className="text-sm text-navy-700 hover:underline">
          View their card →
        </Link>
      </div>
      <FormShell
        title={`Edit: ${a.full_name}`}
        backHref="/admin/id-cards?kind=staff"
        onSubmit={updateAccreditation.bind(null, a.accreditation_id)}
        submitLabel="Save changes"
      >
        <AccreditationFields a={a} teams={(teams ?? []) as any[]} />
      </FormShell>
    </div>
  );
}
