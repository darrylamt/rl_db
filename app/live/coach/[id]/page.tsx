import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PersonRecord } from "@/components/live/PersonRecord";
import { getCoachRecord } from "@/lib/officiating";

export const dynamic = "force-dynamic";

export default async function CoachPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();

  // Named columns rather than *, so the phone number and email on the
  // register never reach the browser.
  const { data } = await supabase
    .from("coaches")
    .select(
      "coach_id, first_name, last_name, role, qualification, region, nationality, photo_url, team:team_id(name)"
    )
    .eq("coach_id", params.id)
    .maybeSingle();

  if (!data) notFound();
  const c = data as any;
  const club = Array.isArray(c.team) ? c.team[0] : c.team;
  const record = await getCoachRecord(params.id);

  return (
    <PersonRecord
      eyebrow="Coach"
      name={`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Coach"}
      photoUrl={c.photo_url ?? null}
      meta={[club?.name, c.role, c.qualification, c.region]}
      record={record}
      showOutcomes
      caveat="A coach's record covers matches with a team sheet naming them. Two thirds of matches on record have no team sheet at all, so this counts what is written down rather than everything that was coached."
    />
  );
}
