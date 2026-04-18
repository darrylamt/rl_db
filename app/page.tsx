import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-navy-900 text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <header className="border-b border-navy-700 pb-8 mb-12">
          <p className="text-gold-400 font-display tracking-[0.2em] text-sm mb-2">
            GHANA RUGBY LEAGUE FEDERATION
          </p>
          <h1 className="font-display text-5xl md:text-6xl font-bold leading-tight">
            GRLF Management Platform
          </h1>
          <p className="text-navy-200 mt-4 max-w-2xl">
            Fixtures, results, players, officials and standings — one source of truth for Ghana Rugby League.
          </p>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <section className="bg-navy-800 border border-navy-700 rounded-lg p-6">
            <h2 className="font-display text-2xl text-gold-400 mb-2">
              Match Day Entry
            </h2>
            <p className="text-navy-200 text-sm mb-6">
              Federation officials — record results, events, and fixtures from the touchline.
            </p>
            <div className="space-y-2">
              <Link
                href="/enter/result"
                className="block bg-navy-700 hover:bg-navy-600 px-4 py-3 rounded border border-navy-600 transition"
              >
                Enter Match Result →
              </Link>
              <Link
                href="/enter/events"
                className="block bg-navy-700 hover:bg-navy-600 px-4 py-3 rounded border border-navy-600 transition"
              >
                Enter Match Events →
              </Link>
              <Link
                href="/enter/fixture"
                className="block bg-navy-700 hover:bg-navy-600 px-4 py-3 rounded border border-navy-600 transition"
              >
                Enter Fixture →
              </Link>
            </div>
          </section>

          <section className="bg-navy-800 border border-navy-700 rounded-lg p-6">
            <h2 className="font-display text-2xl text-gold-400 mb-2">
              Federation Admin
            </h2>
            <p className="text-navy-200 text-sm mb-6">
              Manage teams, players, officials and competitions.
            </p>
            <Link
              href="/admin/login"
              className="inline-block bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-6 py-3 rounded transition"
            >
              Admin Login →
            </Link>
          </section>
        </div>

        <footer className="mt-16 pt-8 border-t border-navy-700 text-navy-400 text-sm">
          © {new Date().getFullYear()} Ghana Rugby League Federation.
        </footer>
      </div>
    </main>
  );
}
