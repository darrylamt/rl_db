import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/server";
import { PersonRecord } from "@/components/live/PersonRecord";
import { getOfficialRecord } from "@/lib/officiating";

export const dynamic = "force-dynamic";

export default async function OfficialPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createPublicClient();

  // The view rather than the table: it is the one that leaves the phone
  // number and the email behind.
  const { data } = await supabase
    .from("public_officials")
    .select("official_id, first_name, last_name, role, region, nationality, photo_url")
    .eq("official_id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const o = data as any;
  const record = await getOfficialRecord(params.id);

  return (
    <PersonRecord
      eyebrow="Match official"
      name={`${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || "Official"}
      photoUrl={o.photo_url ?? null}
      meta={[o.role, o.region, o.nationality]}
      record={record}
      showOutcomes={false}
    />
  );
}
