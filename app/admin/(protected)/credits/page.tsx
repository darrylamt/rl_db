import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { Avatar } from "@/components/Avatar";
import { CreditAwardForm } from "@/components/admin/CreditAwardForm";
import { getRules, getWallet, creditsAreLive, currentSeason } from "@/lib/credits";
import { awardCredit, reverseCredit, sweepSeason } from "./actions";

export const dynamic = "force-dynamic";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams?: { season?: string; club?: string; error?: string; note?: string };
}) {
  const supabase = createAdminClient();
  const season = searchParams?.season ?? currentSeason();

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("team_id, name, logo_url")
    .eq("team_type", "club")
    .neq("is_public", false)
    .order("name");

  let rules: Awaited<ReturnType<typeof getRules>> = [];
  let live = false;
  let notMigrated = false;

  try {
    rules = await getRules();
    live = await creditsAreLive(season);
    notMigrated = rules.length === 0;
  } catch {
    notMigrated = true;
  }

  const clubs = (teams ?? []) as any[];
  const wallets = notMigrated
    ? []
    : await Promise.all(
        clubs.map(async (t) => ({
          team: t,
          wallet: await getWallet(t.team_id, season),
        }))
      );

  wallets.sort((a, b) => b.wallet.total - a.wallet.total);

  const focus = searchParams?.club
    ? wallets.find((w) => w.team.team_id === searchParams.club)
    : null;

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Club Credits" />

      <p className="text-sm text-slate-500 -mt-3 mb-4 max-w-2xl">
        What each club has earned and lost. Every entry stays on record — a
        mistake is reversed with an opposite entry, never deleted, so a club
        can always see what happened and why.
      </p>

      {searchParams?.error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.error}
        </div>
      )}
      {searchParams?.note && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm px-3 py-2.5 rounded mb-4">
          {searchParams.note}
        </div>
      )}

      {notMigrated ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/club_credits.sql</code> to turn
          this on.
        </div>
      ) : (
        <>
          {!live && (
            <div className="bg-sky-50 border border-sky-200 text-sky-900 text-sm px-3 py-2.5 rounded mb-4">
              <strong>{season} is a rehearsal.</strong> Credits are worked out
              and clubs can watch their wallet, but nothing is redeemable and
              no club is penalised under rules it did not have. Change the
              season it goes live from in <code className="font-mono">credit_settings</code>.
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <form className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-wider text-slate-500">
                Season
              </label>
              <input
                name="season"
                defaultValue={season}
                className="w-24 px-2 py-1.5 rounded border border-slate-300 text-sm"
              />
              <button className="text-xs px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50">
                Show
              </button>
            </form>

            <form action={sweepSeason.bind(null, season)}>
              <button className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2 rounded">
                Work out {season}&apos;s automatic credits
              </button>
            </form>
          </div>

          {/* The table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Club</th>
                  <th className="px-4 py-2.5 font-medium text-right">Earned</th>
                  <th className="px-4 py-2.5 font-medium text-right">Lost</th>
                  <th className="px-4 py-2.5 font-medium text-right">Balance</th>
                  <th className="hidden sm:table-cell px-4 py-2.5 font-medium text-right">
                    Entries
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wallets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                      No clubs on record.
                    </td>
                  </tr>
                ) : (
                  wallets.map(({ team, wallet }) => (
                    <tr key={team.team_id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <a
                          href={`/admin/credits?season=${season}&club=${team.team_id}`}
                          className="flex items-center gap-2 font-medium text-navy-900 hover:underline"
                        >
                          <Avatar src={team.logo_url} name={team.name} size={24} />
                          {team.name}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                        +{wallet.earned}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-red-700">
                        {wallet.deducted || 0}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-display text-lg text-navy-900">
                        {wallet.total}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-2.5 text-right text-slate-500 text-xs">
                        {wallet.entries.length}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <CreditAwardForm
            clubs={clubs}
            rules={rules}
            season={season}
            award={awardCredit}
          />

          {/* One club's ledger */}
          {focus && (
            <section className="mt-6">
              <h2 className="font-display text-lg text-navy-900 mb-3">
                {focus.team.name} — every entry for {season}
              </h2>
              {focus.wallet.entries.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
                  Nothing recorded for this club yet.
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {focus.wallet.entries.map((e) => (
                    <div key={e.entry_id} className="px-4 py-2.5 flex items-start gap-3">
                      <span
                        className={`font-display tabular-nums w-14 shrink-0 text-right ${
                          e.amount >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {e.amount > 0 ? "+" : ""}
                        {e.amount}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-navy-900">{e.description}</span>
                        <span className="block text-xs text-slate-500">
                          {String(e.created_at).slice(0, 10)}
                          {e.automatic ? " · worked out by the system" : " · by hand"}
                          {e.shadow ? " · rehearsal" : ""}
                          {e.note ? ` · ${e.note}` : ""}
                        </span>
                      </span>
                      <form
                        action={reverseCredit.bind(null, e.entry_id)}
                        className="shrink-0"
                      >
                        <input type="hidden" name="why" value="Reversed by the federation" />
                        <button className="text-xs text-slate-500 hover:text-red-700">
                          Reverse
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
