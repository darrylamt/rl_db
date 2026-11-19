import type { MetadataRoute } from "next";

/**
 * What search engines may crawl on rl-db.
 *
 * The public site is rlghana.com; this is the federation's platform. The
 * /live pages can stay findable, but not every filter and comparison of
 * them: "?vs=" alone turns 500 player pages into 250,000, and each one a
 * crawler fetched cost the hosting plan processing time. The portals, the
 * API, print pages and verify links are never for crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Link previews (WhatsApp, X, Facebook) fetch these images.
        allow: ["/live", "/api/og"],
        disallow: ["/*?", "/admin", "/club", "/enter", "/player", "/print", "/verify", "/api", "/docs"],
      },
    ],
  };
}
