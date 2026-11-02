import type { Metadata } from "next";

/**
 * What a /live page shows when it is shared: title, description and the
 * preview card (Open Graph and Twitter tags), for Snapchat, WhatsApp, X and
 * the rest. The cards are the same ones the public website uses, drawn by
 * /api/og/*. Image paths are relative; the root layout's metadataBase makes
 * them absolute, which the apps require.
 */
export function liveShare({
  title,
  description = "Live scores, results and match stats from the Rugby League Federation Ghana.",
  image = "/api/og/site?title=Live%20Scores",
  path,
}: {
  title: string;
  description?: string;
  /** A path on this app, usually /api/og/... */
  image?: string;
  /** The page's own path, for og:url. */
  path?: string;
}): Metadata {
  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "RLFG Live — Rugby League Federation Ghana",
      title,
      description,
      url: path,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** The federation's card with a page's own heading on it. */
export function titledCard(title: string, subtitle?: string) {
  const q = new URLSearchParams({ title, ...(subtitle ? { subtitle } : {}) });
  return `/api/og/site?${q.toString()}`;
}

/**
 * This app's public address, for metadataBase. Set NEXT_PUBLIC_SITE_URL to
 * use a custom domain; on Vercel it otherwise falls back to the project's
 * production address.
 */
export function appOrigin(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("https://rl-db.vercel.app");
}
