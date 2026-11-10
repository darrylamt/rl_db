import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { appOrigin } from "@/lib/liveShare";

// RLFG brand: Poppins for body, Anton for display headings.
//
// The font files live in app/fonts (the latin set from @fontsource, SIL Open
// Font License) rather than being fetched from Google at build time. Fetched,
// the server and browser halves of a build each asked Google separately and
// got slightly different answers, so the page named one font class and the
// stylesheet defined another: no font applied anywhere and every page fell
// back to Times New Roman. Local files hash the same way on both sides.
const poppins = localFont({
  src: [
    { path: "./fonts/poppins-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/poppins-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/poppins-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/poppins-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/poppins-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const anton = localFont({
  src: [{ path: "./fonts/anton-latin-400-normal.woff2", weight: "400", style: "normal" }],
  variable: "--font-anton",
  display: "swap",
  fallback: ["Impact", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  // Shared links need absolute addresses for their preview images.
  metadataBase: appOrigin(),
  title: "RLFG — Rugby League Federation Ghana",
  description: "Official management platform for the Rugby League Federation Ghana",
  icons: {
    icon: "/federationlogo.png",
    apple: "/federationlogo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${anton.variable} ${poppins.className}`}
    >
      <body className="font-sans antialiased bg-white text-navy-900">
        {children}
      </body>
    </html>
  );
}
