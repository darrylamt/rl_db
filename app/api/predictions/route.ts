import { ok, fail, preflight, readJson } from "@/lib/api";
import { castVote, getPredictionCountsFor } from "@/lib/predictions";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * GET /api/predictions?fixtures=<id>,<id>
 *
 * "Who will win?" counts for up to 50 matches: { [fixture_id]: { home, away } }.
 * The same votes /live shows; the website reads them here. Counts only, never
 * who voted.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("fixtures") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => UUID_RE.test(s))
    .slice(0, 50);
  if (!ids.length) return fail("Pass ?fixtures=<id>,<id>");
  // Short: a fan who has just voted reloads and expects to see it.
  return ok(await getPredictionCountsFor(ids), { cache: "short" });
}

/**
 * POST /api/predictions  { fixture_id, device_id, choice: "home" | "away" }
 *
 * Casts or changes this browser's pick, under the same rules as /live
 * (lib/predictions castVote): closed once the match kicks off. Answers with
 * the match's counts after the vote, so the page can show the split at once.
 */
export async function POST(req: Request) {
  const body = await readJson<{ fixture_id?: string; device_id?: string; choice?: string }>(req);
  const fixtureId = body?.fixture_id ?? "";
  const deviceId = body?.device_id ?? "";
  const choice = body?.choice;
  if (!UUID_RE.test(fixtureId)) return fail("Which match?");
  if (!deviceId || !/^[A-Za-z0-9-]{8,64}$/.test(deviceId)) return fail("Invalid device id");
  if (choice !== "home" && choice !== "away") return fail("Pick home or away");

  try {
    await castVote(fixtureId, deviceId, choice);
  } catch (err: any) {
    return fail(err?.message ?? "Could not record the vote", 400);
  }
  const counts = await getPredictionCountsFor([fixtureId]);
  return ok(counts[fixtureId] ?? { home: 0, away: 0 }, { cache: "none" });
}
