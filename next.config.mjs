// If the whole app ever renders in Times New Roman after a deploy: the build
// restored Vercel's cache, and the server and browser halves came out naming
// the next/font classes differently (the page asked for one class, the CSS
// defined another), so no font applied. This file is a build dependency, so
// any edit to it throws that cache away and the next build starts clean.
// Last cleared: 10 Nov 2026.

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
