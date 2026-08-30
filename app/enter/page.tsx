import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * The screen a recorder lands on when they open the phone at a ground.
 *
 * Everything here is one tap from the match in front of them. The old entry
 * screens each began with "find your fixture in a dropdown", which is the
 * wrong first move when a game is about to kick off.
 */
export default async function EnterHomePage() {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: fixtures } = await supabase
    .from("fixtures")
    .select(
      "fixture_id, scheduled_date, scheduled_time, status, home:home_team_id(name), away:away_team_id(name), venue:venue_id(name), competition:competition_id(name), result:match_results(home_score, away_score)"
    )
    .gte("scheduled_date", today)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .limit(12);

  const rows = (fixtures ?? []) as any[];
  const todays = rows.filter((f) => f.scheduled_date === today);
  const later = rows.filter((f) => f.scheduled_date !== today).slice(0, 6);

  const Match = ({ f, live }: { f: any; live: boolean }) => {
    const r = Array.isArray(f.result) ? f.result[0] : f.result;
    return (
      <div
        className={`rounded-lg border p-4 ${
          live ? "border-ghanaYellow-500/40 bg-neutral-900" : "border-white/10 bg-neutral-950"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium leading-tight">
              {f.home?.name} <span className="text-slate-500">v</span> {f.away?.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {[f.scheduled_time?.slice(0, 5), f.venue?.name, f.competition?.name]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {r && (
            <span className="font-display tabular-nums text-lg shrink-0">
              {r.home_score}–{r.away_score}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Link
            href={`/enter/events?fixture=${f.fixture_id}`}
            className="text-center text-sm font-medium bg-ghanaYellow-500 text-black rounded px-3 py-2.5 hover:bg-ghanaYellow-400"
          >
            Record events
          </Link>
          <Link
            href={`/enter/result?fixture=${f.fixture_id}`}
            className="text-center text-sm font-medium border border-white/20 rounded px-3 py-2.5 hover:border-white/50"
          >
            Final score
          </Link>
        </div>
        <Link
          href={`/live/${f.fixture_id}`}
          className="block text-center text-[11px] text-slate-500 hover:text-slate-300 mt-2"
        >
          See what the public sees →
        </Link>
      </div>
    );
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-2xl">Match Day</h1>
        <p className="text-sm text-slate-400 mt-1">
          Pick the match you are at. Anything you save appears on the live page
          straight away.
        </p>
      </div>

      <section>
        <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
          Today
        </h2>
        {todays.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-neutral-950 p-6 text-center text-sm text-slate-400">
            No match scheduled for today.
            <Link href="/enter/fixture" className="block text-ghanaYellow-500 mt-2 hover:underline">
              Add a fixture
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {todays.map((f) => (
              <Match key={f.fixture_id} f={f} live />
            ))}
          </div>
        )}
      </section>

      {later.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Coming up
          </h2>
          <div className="grid gap-3">
            {later.map((f) => (
              <Match key={f.fixture_id} f={f} live={false} />
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-slate-500 border-t border-white/10 pt-4">
        A match not listed?{" "}
        <Link href="/enter/fixture" className="text-ghanaYellow-500 hover:underline">
          Add the fixture first
        </Link>
        , then come back here.
      </p>
    </div>
  );
}
