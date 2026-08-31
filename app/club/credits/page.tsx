import { requireClub } from "@/lib/auth";
import { getWallet, creditsAreLive, currentSeason } from "@/lib/credits";

export const dynamic = "force-dynamic";

export default async function ClubCreditsPage({
  searchParams,
}: {
  searchParams?: { season?: string };
}) {
  const { teamId } = await requireClub();
  const season = searchParams?.season ?? currentSeason();

  let wallet;
  let live = false;
  let notMigrated = false;
  try {
    wallet = await getWallet(teamId, season);
    live = await creditsAreLive(season);
  } catch {
    notMigrated = true;
  }

  if (notMigrated || !wallet) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold text-navy-900">Credits</h1>
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded mt-4">
          Credits are not switched on yet.
        </div>
      </div>
    );
  }

  // Grouped so a club can see where its credits came from, which is the
  // question it will actually ask.
  const byReason = new Map<string, { total: number; count: number }>();
  for (const e of wallet.entries) {
    const key = e.description.replace(/ in .*$| for .*$| on .*$/i, "");
    const cur = byReason.get(key) ?? { total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    byReason.set(key, cur);
  }
  const summary = Array.from(byReason).sort((a, b) => b[1].total - a[1].total);

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-display text-2xl font-bold text-navy-900">Credits</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          What your club has earned and lost in {season}. Credits are not cash
          — the federation uses them to support your club with players,
          equipment, dues subsidies and development.
        </p>
      </div>

      {!live && (
        <div className="bg-sky-50 border border-sky-200 text-sky-900 text-sm px-3 py-2.5 rounded mb-4">
          <strong>{season} is a trial run.</strong> Everything here is being
          worked out so you can see how it adds up, but nothing counts against
          you and nothing can be spent yet.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <div className="bg-navy-900 text-white rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-navy-200">
            {live ? "Available" : "Trial balance"}
          </p>
          <p className="font-display text-4xl font-bold tabular-nums">
            {live ? wallet.available : wallet.total}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Earned</p>
          <p className="font-display text-3xl text-emerald-700 tabular-nums">
            +{wallet.earned}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Lost</p>
          <p className="font-display text-3xl text-red-700 tabular-nums">
            {wallet.deducted || 0}
          </p>
        </div>
      </div>

      {summary.length > 0 && (
        <section className="mb-6">
          <h2 className="font-display text-lg text-navy-900 mb-2">Where it came from</h2>
          <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {summary.map(([label, s]) => (
              <li key={label} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 text-navy-900">
                  {label}
                  {s.count > 1 && (
                    <span className="text-slate-400"> × {s.count}</span>
                  )}
                </span>
                <span
                  className={`font-display tabular-nums shrink-0 ${
                    s.total >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {s.total > 0 ? "+" : ""}
                  {s.total}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-lg text-navy-900 mb-2">Every entry</h2>
        {wallet.entries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
            Nothing recorded for {season} yet.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {wallet.entries.map((e) => (
              <div key={e.entry_id} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                <span
                  className={`font-display tabular-nums w-14 shrink-0 text-right ${
                    e.amount >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {e.amount > 0 ? "+" : ""}
                  {e.amount}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-navy-900 break-words">{e.description}</span>
                  <span className="block text-xs text-slate-500">
                    {String(e.created_at).slice(0, 10)}
                    {e.note ? ` · ${e.note}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-3">
          Think a credit is wrong? Raise it with the federation — every entry
          here stays on record, and a correction is added beside it rather
          than replacing it.
        </p>
      </section>
    </div>
  );
}
