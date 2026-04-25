import type { Metadata } from "next";
import { Poppins, Anton } from "next/font/google";
import "./globals.css";

// RLFG brand: Poppins for body, Anton for display headings.
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const anton = Anton({
  subsets: ["latin"],
  variable: "--font-anton",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RLFG — Rugby League Federation Ghana",
  description: "Official management platform for the Rugby League Federation Ghana",
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
