import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { getTeamSheetData } from "@/lib/printData";
import { TeamSheetDoc } from "@/lib/printDocs";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/**
 * A club's team sheet, ready to print or save as PDF. Clubs print their own
 * side; the federation can print either side with ?team=.
 */
export default async function PrintTeamSheet({
  params,
  searchParams,
}: {
  params: { fixtureId: string };
  searchParams?: { team?: string };
}) {
  const user = await getAppUser();
  if (!user) redirect(`/admin/login?next=/print/team-sheet/${params.fixtureId}`);
  const teamId = user.role === "club" ? user.teamId : user.role === "federation" ? searchParams?.team ?? null : null;
  if (!teamId) notFound();

  const d = await getTeamSheetData(params.fixtureId, teamId);
  if (!d) notFound();

  return (
    <main className="rl-desk">
      <div className="rl-noprint" style={{ maxWidth: "190mm", margin: "0 auto 12px", display: "flex", gap: 12, alignItems: "center", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
        <Link href={user.role === "club" ? `/club/team-sheets/${params.fixtureId}` : "/admin/team-sheets"} style={{ color: "#152a4a" }}>
          ← Back
        </Link>
        <span style={{ color: "#555" }}>Print, or choose &ldquo;Save as PDF&rdquo; in the print window.</span>
        <PrintButton className="ml-auto inline-flex items-center gap-2 bg-navy-900 text-white px-4 py-2 rounded text-sm font-medium" />
      </div>
      <div className="rl-paper">
        <TeamSheetDoc d={d} />
      </div>
    </main>
  );
}
