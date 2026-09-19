import { notFound } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/server";
import { PersonRecord } from "@/components/live/PersonRecord";
import { readWithOptionalColumns } from "@/lib/optionalColumns";
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
  // level and level_gained arrive with supabase/official_levels.sql. Asking
  // the view for a column it has not got fails the whole select and the page
  // 404s on a real official — which is exactly how the club squads went blank
  // when gender was added. Dropped one at a time instead.
  const { data } = await readWithOptionalColumns<any>(
    "official_id, first_name, last_name, role, level, level_gained, region, nationality, photo_url",
    ["level", "level_gained"],
    (columns) =>
      supabase
        .from("public_officials")
        .select(columns)
        .eq("official_id", params.id)
        .maybeSingle()
  );

  if (!data) notFound();
  const o = data as any;
  const record = await getOfficialRecord(params.id);

  return (
    <PersonRecord
      eyebrow="Match official"
      name={`${o.first_name ?? ""} ${o.last_name ?? ""}`.trim() || "Official"}
      photoUrl={o.photo_url ?? null}
      // The register role is deliberately not here. The eyebrow already says
      // "Match official", and printing "Referee" under the name contradicted
      // the match list below it, where the same person is a touch judge on
      // some games. What they did on a given match is on that match's row.
      meta={[o.level, o.region, o.nationality]}
      record={record}
      showOutcomes={false}
    />
  );
}
