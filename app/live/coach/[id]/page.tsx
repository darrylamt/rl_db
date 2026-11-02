import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { PersonRecord } from "@/components/live/PersonRecord";
import { getCoachRecord } from "@/lib/officiating";
import { liveShare, titledCard } from "@/lib/liveShare";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

/** Shared, a coach's page shows the federation's card with their name. */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { data } = await createAdminClient()
    .from("coaches")
    .select("first_name, last_name")
    .eq("coach_id", params.id)
    .maybeSingle();
  const name = data ? `${(data as any).first_name ?? ""} ${(data as any).last_name ?? ""}`.trim() : "Coach";
  return liveShare({
    title: `${name} — RLFG Live`,
    description: `${name}, coach: every match on record with the Rugby League Federation Ghana.`,
    image: titledCard(name, "Coach · Rugby League Federation Ghana"),
    path: `/live/coach/${params.id}`,
  });
}


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
