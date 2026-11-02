import { Badge, C, Frame, federationLogo, picture, render } from "@/lib/og";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri 6 Nov 2026", written out so it reads the same wherever it is drawn. */
function day(iso: string | null | undefined) {
  if (!iso) return "Date to be confirmed";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const wd = DAYS[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
  return `${wd} ${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * GET /api/og/match/:id
 *
 * A match's link preview: both crests and names, the score once there is
 * one (or "VS" with the kick-off before), the competition, date and venue.
 * The id may be the fixture's id or the readable slug the website uses.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const origin = new URL(req.url).origin;
  const r = await fetch(`${origin}/api/fixtures/${encodeURIComponent(params.id)}`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
  const j = r ? await r.json().catch(() => null) : null;
  const f = j?.ok ? j.data : null;
  if (!f) return Response.redirect(`${origin}/api/og/site`, 302);

  const home = f.home_team ?? {};
  const away = f.away_team ?? {};
  const result = f.result ?? null;
  const live = f.status === "live";
  const scored = result && result.home_score != null && result.away_score != null;
  const [homeCrest, awayCrest, logo] = await Promise.all([picture(home.logo_url), picture(away.logo_url), federationLogo(origin)]);

  const eyebrow = live ? "Live" : f.status === "abandoned" ? "Abandoned" : scored ? "Full time" : "Fixture";
  const when = [day(f.scheduled_date), f.scheduled_time && !scored ? String(f.scheduled_time).slice(0, 5) : null].filter(Boolean).join("  ·  ");

  const side = (team: any, crest: string | null) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 340 }}>
      <Badge src={crest} name={team.name ?? ""} size={200} square />
      <div style={{ display: "flex", fontFamily: "Anton", fontSize: (team.name ?? "").length > 16 ? 38 : 48, textTransform: "uppercase", marginTop: 18, textAlign: "center", justifyContent: "center", lineHeight: 1.1 }}>
        {team.name ?? ""}
      </div>
    </div>
  );

  return render(
    <Frame logo={logo} eyebrow={[eyebrow, f.competition?.name].filter(Boolean).join("  ·  ")}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          {side(home, homeCrest)}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            {scored ? (
              <div style={{ display: "flex", fontFamily: "Anton", fontSize: 120, lineHeight: 1 }}>
                {`${result.home_score} – ${result.away_score}`}
              </div>
            ) : (
              <div style={{ display: "flex", fontFamily: "Anton", fontSize: 72, color: C.yellow }}>VS</div>
            )}
          </div>
          {side(away, awayCrest)}
        </div>
        <div style={{ display: "flex", justifyContent: "center", fontSize: 24, color: C.slate, marginTop: 20 }}>
          {[when, f.venue?.name].filter(Boolean).join("  ·  ")}
        </div>
      </div>
    </Frame>
  );
}
