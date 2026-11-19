import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { getTransferSheetData } from "@/lib/printData";
import { TransferSheetDoc } from "@/lib/printDocs";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/**
 * The transfer (or loan) sheet, once all four parties have agreed.
 *
 * Only the four parties can open it: the federation, the two clubs and the
 * player. Before the federation has approved, there is no sheet to print.
 */
export default async function PrintTransfer({ params }: { params: { id: string } }) {
  const user = await getAppUser();
  if (!user) redirect(`/admin/login?next=/print/transfer/${params.id}`);

  const sheet = await getTransferSheetData(params.id);
  if (!sheet) notFound();
  const r = sheet.raw;

  const allowed =
    (user.role === "federation" && user.provisioned && !user.onHold) ||
    (user.role === "club" && !!user.teamId && (user.teamId === r.from_team_id || user.teamId === r.to_team_id)) ||
    (user.role === "player" && user.playerId === r.player_id);
  if (!allowed) notFound();

  const back = user.role === "club" ? "/club/transfers" : user.role === "player" ? "/player/transfers" : "/admin/transfer-requests";

  return (
    <main className="rl-desk">
      <div className="rl-noprint" style={{ maxWidth: "190mm", margin: "0 auto 12px", display: "flex", gap: 12, alignItems: "center", fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
        <Link href={back} style={{ color: "#152a4a" }}>
          ← Back
        </Link>
        {r.status === "approved" ? (
          <>
            <span style={{ color: "#555" }}>Print, or choose &ldquo;Save as PDF&rdquo; in the print window.</span>
            <PrintButton className="ml-auto inline-flex items-center gap-2 bg-navy-900 text-white px-4 py-2 rounded text-sm font-medium" />
          </>
        ) : (
          <span style={{ color: "#8a4b00" }}>Not final yet: this sheet can be printed once all four parties have agreed.</span>
        )}
      </div>
      {r.status === "approved" && (
        <div className="rl-paper">
          <TransferSheetDoc d={sheet.data} />
        </div>
      )}
    </main>
  );
}
