import { C, Frame, federationLogo, render } from "@/lib/og";

export const dynamic = "force-dynamic";

/**
 * GET /api/og/site?title=…&subtitle=…
 *
 * The site's own link preview: the crest large, the federation's name, and
 * what the site holds. With a title, the same card headed with a page's name
 * (Events, Standings…), for pages without a card of their own.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = (url.searchParams.get("title") ?? "").slice(0, 80);
  const subtitle = (url.searchParams.get("subtitle") ?? "").slice(0, 120);
  const logo = await federationLogo(url.origin);

  return render(
    <Frame logo={null}>
      <div style={{ display: "flex", alignItems: "center", gap: 56, width: "100%" }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={logo} width={300} height={300} style={{ width: 300, height: 300, objectFit: "contain" }} />
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: C.yellow, textTransform: "uppercase" }}>
            {title ? "Rugby League Federation Ghana" : "Official website"}
          </div>
          <div style={{ display: "flex", fontFamily: "Anton", fontSize: title ? 96 : 84, lineHeight: 1.05, marginTop: 10, textTransform: "uppercase" }}>
            {title || "Rugby League Federation Ghana"}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: C.slate, marginTop: 20 }}>
            {subtitle || "Fixtures · Results · Standings · Clubs · Players"}
          </div>
        </div>
      </div>
    </Frame>
  );
}
