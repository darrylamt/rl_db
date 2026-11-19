/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The link-preview images (/api/og/*) read their fonts from disk; this
    // makes sure the font files are packed with those routes when deployed.
    outputFileTracingIncludes: {
      "/api/og/**/*": ["./assets/fonts/**/*"],
      // ID cards also draw the federation crest from the public folder,
      // which is not part of a server function unless asked for.
      "/api/admin/id-card/**/*": ["./assets/fonts/**/*", "./public/federationlogo.png"],
    },
  },
};

export default nextConfig;
