import { createPublicClient } from "@/lib/supabase/server";
import { Badge, C, Frame, Stat, federationLogo, picture, render } from "@/lib/og";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * GET /api/og/club/:slug
 *
 * A club's link preview: crest, name, where and since when, and its record
 * from every result on file. The slug is what the website's club pages use;
 * a team id works too.
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const origin = new URL(req.url).origin;
  const supabase = createPublicClient();

  const { data: team } = await supabase
    .from("teams")
    .select("team_id, name, logo_url, city, region, founded_year")
    .eq(UUID_RE.test(params.slug) ? "team_id" : "slug", params.slug)
    .maybeSingle();
  if (!team) return Response.redirect(`${origin}/api/og/site`, 302);

  // Every result, from this club's side.
  const { data: fixtures } = await supabase
    .from("fixtures")
    .select("home_team_id, away_team_id, result:match_results(home_score, away_score)")
    .or(`home_team_id.eq.${team.team_id},away_team_id.eq.${team.team_id}`);
  let won = 0, drawn = 0, lost = 0;
  for (const f of (fixtures ?? []) as any[]) {
    const r = Array.isArray(f.result) ? f.result[0] : f.result;
    if (r?.home_score == null || r?.away_score == null) continue;
    const home = f.home_team_id === team.team_id;
    const ours = home ? r.home_score : r.away_score;
    const theirs = home ? r.away_score : r.home_score;
    if (ours > theirs) won++;
    else if (ours < theirs) lost++;
    else drawn++;
  }
  const played = won + drawn + lost;

  const [crest, logo] = await Promise.all([picture(team.logo_url), federationLogo(origin)]);
  const where = [team.city, team.region].filter(Boolean).join(", ");
  const since = team.founded_year ? `Est. ${team.founded_year}` : null;

  return render(
    <Frame logo={logo} eyebrow="Club">
      <div style={{ display: "flex", alignItems: "center", gap: 56, width: "100%" }}>
        <Badge src={crest} name={team.name} size={320} square />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: team.name.length > 18 ? 72 : 92, lineHeight: 1.05, textTransform: "uppercase" }}>
            {team.name}
          </div>
          {where || since ? (
            <div style={{ display: "flex", fontSize: 28, color: C.slate, marginTop: 10 }}>{[where, since].filter(Boolean).join("  ·  ")}</div>
          ) : null}
          {played > 0 ? (
            <div style={{ display: "flex", marginTop: 34 }}>
              <Stat value={played} label="Played" />
              <Stat value={won} label="Won" />
              <Stat value={drawn} label="Drawn" />
              <Stat value={lost} label="Lost" />
            </div>
          ) : null}
        </div>
      </div>
    </Frame>
  );
}
