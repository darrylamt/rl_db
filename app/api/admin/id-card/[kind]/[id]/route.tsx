import { getAppUser } from "@/lib/auth";
import { fail } from "@/lib/api";
import { CARD_KINDS, type CardKind, getIdCardData, renderIdCard } from "@/lib/idCard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/id-card/:kind/:id?side=front|back[&download=1]
 * kind: player | coach | official | management | staff
 *
 * One side of an ID card as a print-ready PNG. Issued by the federation
 * only: club, recorder and player accounts are refused even though they are
 * signed in.
 */
export async function GET(req: Request, { params }: { params: { kind: string; id: string } }) {
  const user = await getAppUser();
  if (!user) return fail("Unauthorized", 401);
  if (user.role !== "federation" || !user.provisioned || user.onHold) {
    return fail("Only the federation can issue ID cards", 403);
  }
  if (!CARD_KINDS.includes(params.kind as CardKind)) return fail("Unknown card type", 404);

  const url = new URL(req.url);
  const side = url.searchParams.get("side") === "back" ? "back" : "front";
  const data = await getIdCardData(params.kind as CardKind, params.id);
  if (!data) return fail("Not found", 404);

  const res = await renderIdCard(data, side);
  if (url.searchParams.get("download")) {
    res.headers.set("Content-Disposition", `attachment; filename="${data.cardNumber}-${side}.png"`);
  }
  return res;
}
