import { getAppUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { cardNumberFor, getIdCardData, renderIdCard } from "@/lib/idCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/id-card/:playerId?side=front|back[&download=1]
 *
 * A player's ID card, one side at a time, as a print-ready PNG. Issued by
 * the federation only: club, recorder and player accounts are refused even
 * though they are signed in.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getAppUser();
  if (!user) return fail("Unauthorized", 401);
  if (user.role !== "federation" || !user.provisioned || user.onHold) {
    return fail("Only the federation can issue ID cards", 403);
  }

  const url = new URL(req.url);
  const side = url.searchParams.get("side") === "back" ? "back" : "front";
  const data = await getIdCardData(params.id);
  if (!data) return fail("Player not found", 404);

  const res = await renderIdCard(data, side);
  if (url.searchParams.get("download")) {
    res.headers.set(
      "Content-Disposition",
      `attachment; filename="${cardNumberFor(params.id)}-${side}.png"`
    );
  }
  return res;
}
