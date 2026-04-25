import Link from "next/link";

// /enter forms read live data from Supabase on mount — no point prerendering.
export const dynamic = "force-dynamic";

export default function EnterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ghana flag accent strip */}
      <div className="flex h-1 w-full">
        <div className="flex-1 bg-ghanaRed-500" />
        <div className="flex-1 bg-ghanaYellow-500" />
        <div className="flex-1 bg-ghanaGreen-500" />
      </div>
      <header className="bg-neutral-950 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-ghanaYellow-500 text-sm tracking-widest">
              RLFG
            </span>
            <span className="text-slate-300 text-xs">Match Day Entry</span>
          </Link>
          <nav className="flex gap-3 text-xs">
            <Link href="/enter/result" className="text-slate-300 hover:text-ghanaYellow-500">
              Result
            </Link>
            <Link href="/enter/events" className="text-slate-300 hover:text-ghanaYellow-500">
              Events
            </Link>
            <Link href="/enter/fixture" className="text-slate-300 hover:text-ghanaYellow-500">
              Fixture
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6 md:py-8">{children}</main>
    </div>
  );
}
