import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Ghana flag accent strip */}
      <div className="flex h-1.5 w-full">
        <div className="flex-1 bg-ghanaRed-500" />
        <div className="flex-1 bg-ghanaYellow-500" />
        <div className="flex-1 bg-ghanaGreen-500" />
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <header className="border-b border-white/10 pb-6 md:pb-8 mb-8 md:mb-12">
          <div className="flex items-center gap-4 mb-4">
            <Image src="/federationlogo.png" alt="RLFG" width={64} height={64} className="rounded-lg" />
            <p className="text-ghanaYellow-500 font-display tracking-[0.2em] text-xs md:text-sm">
              RUGBY LEAGUE FEDERATION GHANA
            </p>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold leading-tight">
            RLFG Management Platform
          </h1>
          <p className="text-slate-300 text-sm md:text-base mt-4 max-w-2xl">
            Fixtures, results, players, officials and standings — one source of truth for Ghana Rugby League.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <section className="bg-neutral-900 border border-white/10 rounded-lg p-6">
            <h2 className="font-display text-2xl text-ghanaYellow-500 mb-2">
              Match Day Entry
            </h2>
            <p className="text-slate-300 text-sm mb-6">
              Federation officials — record results, events, and fixtures from the touchline.
            </p>
            <div className="space-y-2">
              <Link
                href="/enter/result"
                className="block bg-neutral-800 hover:bg-neutral-700 px-4 py-3 rounded border border-white/10 transition"
              >
                Enter Match Result →
              </Link>
              <Link
                href="/enter/events"
                className="block bg-neutral-800 hover:bg-neutral-700 px-4 py-3 rounded border border-white/10 transition"
              >
                Enter Match Events →
              </Link>
              <Link
                href="/enter/fixture"
                className="block bg-neutral-800 hover:bg-neutral-700 px-4 py-3 rounded border border-white/10 transition"
              >
                Enter Fixture →
              </Link>
            </div>
          </section>

          <section className="bg-neutral-900 border border-white/10 rounded-lg p-6">
            <h2 className="font-display text-2xl text-ghanaYellow-500 mb-2">
              Federation Admin
            </h2>
            <p className="text-slate-300 text-sm mb-6">
              Manage teams, players, officials and competitions.
            </p>
            <Link
              href="/admin/login"
              className="inline-block bg-ghanaRed-500 hover:bg-ghanaRed-600 text-white font-semibold px-6 py-3 rounded transition"
            >
              Admin Login →
            </Link>
          </section>
        </div>

        <footer className="mt-16 pt-8 border-t border-white/10 text-slate-400 text-sm">
          © {new Date().getFullYear()} Rugby League Federation Ghana.
        </footer>
      </div>
    </main>
  );
}
