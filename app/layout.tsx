import type { Metadata } from "next";
import { Poppins, Anton, Lato, Bebas_Neue } from "next/font/google";
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

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-lato",
  weight: ["300", "400", "700", "900"],
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
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
      className={`${poppins.variable} ${anton.variable} ${lato.variable} ${bebasNeue.variable} ${poppins.className}`}
    >
      <body className="font-sans antialiased bg-white text-navy-900">
        {children}
      </body>
    </html>
  );
}
