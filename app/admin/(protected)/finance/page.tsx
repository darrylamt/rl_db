import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import {
  BASE_ALLOCATION,
  CARRY_OVER_SHARE,
  LEVY_RATE,
  LOAN_SHARE,
  PER_EXTRA_GRADE,
  PER_SEASON,
  SEASON_BONUS_CAP,
  carryOverCap,
  formatLX,
  formatSigned,
  getClubBudgets,
} from "@/lib/lx";
import { getSeasonState } from "@/lib/seasons";
import { grantSeasonBudgets, adjustBalance, saveSeason } from "./actions";

export const dynamic = "force-dynamic";

const KIND_WORDS: Record<string, string> = {
  allocation: "Season budget",
  expiry: "Carry-over expired",
  fee: "Transfer fee",
  levy: "Levy",
  adjustment: "Adjustment",
};

export default async function FinancePage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string };
}) {
  // Which season is being funded. While one is running it is that one; once
  // it has ended the money on offer belongs to the season that follows.
  const state = await getSeasonState();
  const season = state.ended && state.next ? state.next.season : state.season;
  const { budgets, books } = await getClubBudgets(season);

  // Names for the ledger. Read separately rather than joined, so a club that
  // is later removed does not take its own history off the screen.
  const supabase = createAdminClient();
  const [{ data: teams }, { data: people }] = await Promise.all([
    supabase.from("teams").select("team_id, name"),
    supabase.from("players").select("player_id, first_name, last_name"),
  ]);
  const teamName = new Map((teams ?? []).map((t: any) => [t.team_id, t.name]));
  const playerName = new Map(
    (people ?? []).map((p: any) => [
      p.player_id,
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    ])
  );

  const outstanding = budgets.filter((b) => !b.granted);
  const overdrawn = budgets.filter((b) => b.balance < 0);
  const recent = books.entries.slice(0, 60);

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="LeagueX" eyebrow="FEDERATION BANK" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        The federation does not move money, so LeagueX stands in for it. Clubs
        are granted a budget each season, transfers move it between them, and a
        levy on every deal takes some of it back out of circulation. Nothing
        here is real currency.
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

      {books.notMigrated ? (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded">
          Run <code className="font-mono">supabase/club_budgets.sql</code> to
          turn this on.
        </div>
      ) : (
        <>
          {/* The numbers the federation is actually asked about. */}
          <section className="grid gap-3 sm:grid-cols-3 mb-8">
            <div className="bg-navy-900 text-white rounded-lg p-5">
              <p className="text-xs uppercase tracking-wider text-white/60">
                In the bank
              </p>
              <p className="font-display text-4xl font-bold tabular-nums">
                {formatLX(books.bank)}
              </p>
              <p className="text-xs text-white/60 mt-1">
                Taken in levies. Out of circulation until the federation spends
                it.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Held by clubs
              </p>
              <p className="font-display text-4xl font-bold text-navy-900 tabular-nums">
                {formatLX(books.circulating)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Across {budgets.length} clubs &mdash; what there is to spend.
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                The levy
              </p>
              <p className="font-display text-4xl font-bold text-navy-900 tabular-nums">
                {Math.round(LEVY_RATE * 100)}%
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Added on top of every fee and paid by the buying club. A loan
                costs {Math.round(LOAN_SHARE * 100)}% of the player&rsquo;s
                value.
              </p>
            </div>
          </section>

          {/* When the season runs. Stated by the federation, because a season
              holds several tournaments that finish at different times and a
              boundary read off fixtures would move every time one was entered. */}
          <section className="mb-8">
            <h2 className="font-display text-lg text-navy-900 mb-1">Seasons</h2>
            <p className="text-xs text-slate-500 mb-3 max-w-2xl">
              Budgets are granted against these dates. Nothing happens on its
              own &mdash; this decides which season the grant is for and when
              it may be made, and the federation still presses the button.
            </p>

            {state.fallback ? (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded mb-3">
                No seasons are on record, so the calendar year is standing in
                and budgets roll over on 1 January. Run{" "}
                <code className="font-mono">supabase/seasons.sql</code> and set
                the real dates below.
              </div>
            ) : state.ended ? (
              <div className="bg-sky-50 border border-sky-300 text-sky-900 text-sm px-3 py-2.5 rounded mb-3">
                The {state.season} season ended on {state.row?.endsOn}.
                {state.next
                  ? ` The ${state.next.season} season runs from ${state.next.startsOn}, and its budgets can be granted now.`
                  : " Add the next season below before its budgets can be granted."}
              </div>
            ) : state.running ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-3 py-2.5 rounded mb-3">
                The {state.season} season is running &mdash; {state.row?.startsOn}{" "}
                to {state.row?.endsOn}.
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 text-slate-700 text-sm px-3 py-2.5 rounded mb-3">
                The {state.season} season has not started yet. It runs{" "}
                {state.row?.startsOn} to {state.row?.endsOn}.
              </div>
            )}

            {state.every.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 mb-3">
                {state.every.map((y) => (
                  <div
                    key={y.season}
                    className="px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
                  >
                    <span className="font-display text-navy-900 w-16 shrink-0">
                      {y.season}
                    </span>
                    <span className="text-slate-600 tabular-nums shrink-0">
                      {y.startsOn} &rarr; {y.endsOn}
                    </span>
                    {y.season === state.season && (
                      <span className="text-[10px] uppercase tracking-wider bg-navy-900 text-white px-1.5 py-0.5 rounded shrink-0">
                        {state.ended ? "Just ended" : "Current"}
                      </span>
                    )}
                    {y.note && (
                      <span className="text-xs text-slate-400 flex-1 min-w-0 truncate">
                        {y.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form
              action={saveSeason}
              className="bg-white border border-slate-200 rounded-lg p-4 grid gap-3 sm:grid-cols-[7rem_1fr_1fr_auto] sm:items-end"
            >
              <label className="text-xs text-slate-600">
                <span className="block mb-1">Season</span>
                <input
                  name="season"
                  required
                  placeholder="2027"
                  className="w-full px-2 py-2 rounded border border-slate-300 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                <span className="block mb-1">Starts on</span>
                <input
                  name="starts_on"
                  type="date"
                  required
                  className="w-full px-2 py-2 rounded border border-slate-300 text-sm"
                />
              </label>
              <label className="text-xs text-slate-600">
                <span className="block mb-1">Ends on</span>
                <input
                  name="ends_on"
                  type="date"
                  required
                  className="w-full px-2 py-2 rounded border border-slate-300 text-sm"
                />
              </label>
              <button className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2 rounded h-fit">
                Save season
              </button>
              <p className="text-[11px] text-slate-400 sm:col-span-4">
                Saving a season that already exists corrects its dates.
              </p>
            </form>
          </section>

          {overdrawn.length > 0 && (
            <section className="bg-red-50 border border-red-300 rounded-lg p-4 mb-6">
              <h2 className="font-display text-lg text-red-900 mb-1">
                {overdrawn.length === 1
                  ? "A club is overdrawn"
                  : `${overdrawn.length} clubs are overdrawn`}
              </h2>
              <p className="text-xs text-red-800 mb-2">
                They were warned and went ahead. The debt carries into next
                season and comes out of their grant.
              </p>
              <ul className="text-sm text-red-900 grid gap-1">
                {overdrawn.map((c) => (
                  <li key={c.teamId} className="flex justify-between gap-3">
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular-nums">{formatLX(c.balance)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* This season's grants. */}
          <section className="mb-8">
            <h2 className="font-display text-lg text-navy-900 mb-1">
              {season} budgets
            </h2>
            <p className="text-xs text-slate-500 mb-3 max-w-2xl">
              {formatLX(BASE_ALLOCATION)} to every club, plus{" "}
              {formatLX(PER_EXTRA_GRADE)} for each grade beyond the first and{" "}
              {formatLX(PER_SEASON)} a season up to {formatLX(SEASON_BONUS_CAP)}.
              It funds what a club has to field, not how well it plays &mdash;
              paying for merit would let the strongest club buy its way further
              ahead every year. Anything carried over above{" "}
              {Math.round(CARRY_OVER_SHARE * 100)}% of the grant expires when
              this is run.
            </p>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr className="text-xs uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-2.5 font-medium">Club</th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        Balance
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        {season} grant
                      </th>
                      <th className="px-4 py-2.5 font-medium text-right">
                        Carry-over cap
                      </th>
                      <th className="px-4 py-2.5 font-medium">Fields</th>
                      <th className="px-4 py-2.5 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {budgets.map((b) => (
                      <tr key={b.teamId}>
                        <td className="px-4 py-2.5 font-medium text-navy-900">
                          {b.name}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right tabular-nums font-display ${
                            b.balance < 0 ? "text-red-700" : "text-navy-900"
                          }`}
                        >
                          {formatLX(b.balance)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                          {formatLX(b.allocation)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                          {formatLX(carryOverCap(b.allocation))}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs">
                          {b.grades} grade{b.grades === 1 ? "" : "s"} &middot;{" "}
                          {b.seasons} season{b.seasons === 1 ? "" : "s"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              b.granted
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {b.granted ? "Granted" : "Not yet"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  {outstanding.length === 0
                    ? `Every club has its ${season} budget.`
                    : `${outstanding.length} club${
                        outstanding.length === 1 ? "" : "s"
                      } waiting on ${formatLX(
                        outstanding.reduce((s, b) => s + b.allocation, 0)
                      )}.`}
                </p>
                <form action={grantSeasonBudgets}>
                  <button
                    disabled={outstanding.length === 0}
                    className="bg-navy-900 hover:bg-navy-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded"
                  >
                    Grant the {season} budgets
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* A correction, by hand. Every economy needs one. */}
          <section className="mb-8">
            <h2 className="font-display text-lg text-navy-900 mb-1">
              Adjust a balance
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              A fine, a grant outside the season, or a mistake put right.
              Negative takes it away. The reason is kept with it.
            </p>
            <form
              action={adjustBalance}
              className="bg-white border border-slate-200 rounded-lg p-4 grid gap-3 sm:grid-cols-[1fr_9rem_2fr_auto] sm:items-end"
            >
              <label className="text-xs text-slate-600">
                <span className="block mb-1">Club</span>
                <select
                  name="team_id"
                  required
                  className="w-full px-2 py-2 rounded border border-slate-300 text-sm"
                >
                  <option value="">Pick a club</option>
                  {budgets.map((b) => (
                    <option key={b.teamId} value={b.teamId}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-600">
                <span className="block mb-1">Amount (LX)</span>
                <input
                  name="amount"
                  type="number"
                  step={1}
                  required
                  placeholder="-50"
                  className="w-full px-2 py-2 rounded border border-slate-300 text-sm tabular-nums"
                />
              </label>
              <label className="text-xs text-slate-600">
                <span className="block mb-1">What it is for</span>
                <input
                  name="note"
                  required
                  placeholder="Fine — unregistered player fielded"
                  className="w-full px-2 py-2 rounded border border-slate-300 text-sm"
                />
              </label>
              <button className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2 rounded h-fit">
                Record it
              </button>
            </form>
          </section>

          {/* Where it all went. */}
          <section>
            <h2 className="font-display text-lg text-navy-900 mb-3">
              Every movement
            </h2>
            {recent.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
                Nothing has moved yet. Grant the {season} budgets to start.
              </div>
            ) : (
              <ul className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {recent.map((e) => {
                  const who =
                    e.team_id === null
                      ? "Federation"
                      : teamName.get(e.team_id) ?? "A club";
                  const about = e.player_id ? playerName.get(e.player_id) : null;
                  return (
                    <li
                      key={e.entry_id}
                      className="px-4 py-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
                    >
                      <span className="text-slate-400 text-xs w-24 shrink-0 tabular-nums">
                        {e.created_at.slice(0, 10)}
                      </span>
                      <span className="font-medium text-navy-900 w-36 shrink-0 truncate">
                        {who}
                      </span>
                      <span className="text-xs text-slate-500 w-32 shrink-0">
                        {KIND_WORDS[e.kind] ?? e.kind}
                      </span>
                      <span className="text-xs text-slate-500 flex-1 min-w-0 truncate">
                        {[
                          about,
                          e.counterparty_team_id
                            ? teamName.get(e.counterparty_team_id)
                            : null,
                          e.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span
                        className={`font-display tabular-nums shrink-0 ${
                          e.amount < 0 ? "text-red-700" : "text-emerald-700"
                        }`}
                      >
                        {formatSigned(e.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {books.entries.length > recent.length && (
              <p className="text-xs text-slate-400 mt-2">
                Showing the last {recent.length} of {books.entries.length}.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
