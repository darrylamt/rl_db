import Link from "next/link";

// /enter forms read live data from Supabase on mount — no point prerendering.
export const dynamic = "force-dynamic";

export default function EnterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <header className="bg-navy-950 border-b border-navy-700">
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-gold-400 text-sm tracking-widest">
              GRLF
            </span>
            <span className="text-navy-200 text-xs">Match Day Entry</span>
          </Link>
          <nav className="flex gap-3 text-xs">
            <Link href="/enter/result" className="text-navy-200 hover:text-gold-400">
              Result
            </Link>
            <Link href="/enter/events" className="text-navy-200 hover:text-gold-400">
              Events
            </Link>
            <Link href="/enter/fixture" className="text-navy-200 hover:text-gold-400">
              Fixture
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
