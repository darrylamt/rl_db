import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

// Public match centre. Nothing here links to /admin or /enter — this is the
// address that gets handed to fans.
export const metadata: Metadata = {
  title: "Live Scores — Rugby League Federation Ghana",
  description:
    "Live scores, results and match stats from the Rugby League Federation Ghana.",
};

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Ghana flag accent strip */}
      <div className="flex h-1 w-full">
        <div className="flex-1 bg-ghanaRed-500" />
        <div className="flex-1 bg-ghanaYellow-500" />
        <div className="flex-1 bg-ghanaGreen-500" />
      </div>

      <header className="bg-black border-b border-white/10 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/live" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/federationlogo.png"
              alt=""
              width={32}
              height={32}
              className="rounded shrink-0"
            />
            <span className="min-w-0">
              <span className="block font-display text-ghanaYellow-500 text-sm tracking-widest leading-none">
                RLFG
              </span>
              <span className="block text-slate-400 text-[11px] leading-tight mt-0.5 truncate">
                Live Scores &amp; Match Centre
              </span>
            </span>
          </Link>
          <nav className="ml-auto flex gap-1 shrink-0">
            <Link
              href="/live/records"
              className="px-3 py-1.5 rounded text-xs text-slate-300 hover:text-ghanaYellow-500 hover:bg-white/5"
            >
              Records
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 md:py-8">
        {children}
      </main>

      <footer className="border-t border-white/10 mt-8">
        <div className="max-w-5xl mx-auto px-4 py-6 text-slate-500 text-xs">
          © {new Date().getFullYear()} Rugby League Federation Ghana. Scores
          update automatically as officials record them.
        </div>
      </footer>
    </div>
  );
}
