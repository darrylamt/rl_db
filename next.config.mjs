/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The link-preview images (/api/og/*) read their fonts from disk; this
    // makes sure the font files are packed with those routes when deployed.
    outputFileTracingIncludes: {
      "/api/og/**/*": ["./assets/fonts/**/*"],
    },
  },
};

export default nextConfig;
