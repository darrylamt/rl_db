import { Badge, C, Frame, Stat, federationLogo, picture, render } from "@/lib/og";

export const dynamic = "force-dynamic";

/**
 * GET /api/og/player/:id
 *
 * A player's link preview: photo, name, club and crest, position and shirt
 * number, and the headline numbers. Read through the public player API, so
 * nothing private (age, contact details, a ban's reason) can reach it.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const origin = new URL(req.url).origin;
  const get = async (path: string) => {
    const r = await fetch(`${origin}${path}`, { signal: AbortSignal.timeout(6000) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    return j?.ok ? j.data : null;
  };

  const p = await get(`/api/players/${encodeURIComponent(params.id)}`);
  if (!p) return Response.redirect(`${origin}/api/og/site`, 302);

  const team = p.team_id ? await get(`/api/teams/${p.team_id}`) : null;
  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  const [photo, crest, logo] = await Promise.all([picture(p.photo_url), picture(team?.logo_url), federationLogo(origin)]);
  const s = p.stats ?? {};
  const line = [p.position, p.jersey_number != null ? `#${p.jersey_number}` : null].filter(Boolean).join("  ·  ");

  return render(
    <Frame logo={logo} eyebrow={p.suspension ? "Player · Suspended" : p.is_captain ? "Player · Captain" : "Player"}>
      <div style={{ display: "flex", alignItems: "center", gap: 56, width: "100%" }}>
        <Badge src={photo} name={name} size={340} square />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: name.length > 22 ? 64 : 80, lineHeight: 1.05, textTransform: "uppercase" }}>
            {name}
          </div>
          {team ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14 }}>
              {crest ? (
                // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                <img src={crest} width={44} height={44} style={{ width: 44, height: 44, objectFit: "contain" }} />
              ) : null}
              <div style={{ display: "flex", fontSize: 30 }}>{team.name}</div>
            </div>
          ) : null}
          {line ? <div style={{ display: "flex", fontSize: 26, color: C.slate, marginTop: 8 }}>{line}</div> : null}
          <div style={{ display: "flex", marginTop: 34 }}>
            <Stat value={s.matches_played ?? 0} label="Matches" />
            <Stat value={s.total_points ?? 0} label="Points" />
            <Stat value={s.tries ?? 0} label="Tries" />
          </div>
        </div>
      </div>
    </Frame>
  );
}
