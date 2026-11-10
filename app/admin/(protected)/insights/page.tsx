import Link from "next/link";
import { ListHeader } from "@/components/admin/ListHeader";
import { ChartCard, ChartEmpty } from "@/components/admin/charts/ChartCard";
import { ColumnChart } from "@/components/admin/charts/ColumnChart";
import { RankedBars } from "@/components/admin/charts/RankedBars";
import { SegmentedBar } from "@/components/admin/charts/SegmentedBar";
import { Meter } from "@/components/admin/charts/Meter";
import { GRADES, getInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

// A grade keeps its colour on every chart here: men blue, women orange,
// youth aqua. Colour follows the thing, never its rank.
const GRADE_COLOR: Record<string, string> = {
  men: "var(--viz-series-1)",
  women: "var(--viz-series-2)",
  youth: "var(--viz-series-3)",
};
const SCORING_COLOR: Record<string, { color: string; ink: "light" | "dark" }> = {
  try: { color: "var(--viz-series-1)", ink: "light" },
  conversion: { color: "var(--viz-series-2)", ink: "light" },
  penalty_goal: { color: "var(--viz-series-3)", ink: "light" },
  drop_goal: { color: "var(--viz-series-4)", ink: "dark" },
};

/**
 * Insights: the federation's record drawn as charts.
 *
 * The top half is the whole history and is not affected by the season
 * switch. The season switch sits above everything it changes.
 */
export default async function InsightsPage({
  searchParams,
}: {
  searchParams?: { season?: string };
}) {
  const d = await getInsights(searchParams?.season);

  const gradeParts = [
    ...GRADES.map((g) => ({
      key: g.key,
      label: g.label,
      value: d.playersByGrade[g.key],
      color: GRADE_COLOR[g.key],
    })),
    // Players with neither a category nor a gender, so the bar still adds up.
    { key: "unset", label: "Not set", value: d.playersByGrade.unset, color: "var(--viz-muted)" },
  ];

  const scoringParts = d.pointsByType.map((p) => ({
    ...p,
    color: SCORING_COLOR[p.key].color,
    ink: SCORING_COLOR[p.key].ink,
  }));
  const seasonPoints = d.pointsByType.reduce((s, p) => s + p.value, 0);

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Insights" eyebrow="OVERVIEW" />
      <p className="text-sm text-slate-500 -mt-3 mb-6 max-w-2xl">
        The record as charts. Point at a bar for its numbers, or open a chart&rsquo;s table.
        Updates within five minutes of a result being entered.
      </p>

      {/* ---------- Every season ---------- */}
      <h2 className="text-[11px] font-medium uppercase tracking-widest text-slate-500 mb-3">
        Every season
      </h2>
      <div className="grid gap-6 lg:grid-cols-2 mb-10">
        <ChartCard
          title="Matches played each season"
          subtitle="Completed matches, split by grade"
          table={{
            columns: ["Season", "Men", "Women", "Youth", "Total"],
            rows: d.seasons.map((s, i) => {
              const r = d.matchesBySeason[i];
              return [s, r.men, r.women, r.youth, r.men + r.women + r.youth];
            }),
          }}
        >
          {d.seasons.length ? (
            <ColumnChart
              categories={d.seasons}
              series={GRADES.map((g) => ({ key: g.key, label: g.label, color: GRADE_COLOR[g.key] }))}
              values={d.matchesBySeason}
              unit="matches"
              label="Matches played each season, by grade"
            />
          ) : (
            <ChartEmpty>No matches have been completed yet.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard
          title="Points per match"
          subtitle="Average points scored in a match, both sides together"
          table={{
            columns: ["Season", "Average points", "Matches with a score"],
            rows: d.seasons.map((s, i) => [s, d.pointsPerMatch[i].avg.toFixed(1), d.pointsPerMatch[i].matches]),
          }}
        >
          {d.pointsPerMatch.some((p) => p.matches) ? (
            <ColumnChart
              categories={d.seasons}
              series={[{ key: "avg", label: "Average points", color: "var(--viz-series-1)" }]}
              values={d.pointsPerMatch.map((p) => ({ avg: p.avg }))}
              unit="points a match"
              decimals={1}
              label="Average points per match, each season"
            />
          ) : (
            <ChartEmpty>No scores recorded yet.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard
          title="Registered players"
          subtitle={`${d.totalPlayers.toLocaleString("en-GB")} players, by grade`}
          table={{
            columns: ["Grade", "Players", "Share"],
            rows: gradeParts
              .filter((p) => p.value > 0)
              .map((p) => [p.label, p.value, `${Math.round((p.value / Math.max(1, d.totalPlayers)) * 100)}%`]),
          }}
        >
          <SegmentedBar parts={gradeParts} unit="players" label="Registered players by grade" />
          <div className="mt-6">
            <Meter label="Marked active" value={d.activePlayers} of={d.totalPlayers} unit="players" />
          </div>
        </ChartCard>

        <ChartCard
          title="Active players by club"
          subtitle="Players marked active, on each club's books"
          table={{ columns: ["Club", "Active players"], rows: d.squads.map((s) => [s.label, s.value]) }}
        >
          {d.squads.length ? (
            <RankedBars items={d.squads} unit="active players" total={d.activePlayers} label="Active players by club" />
          ) : (
            <ChartEmpty>No active players on any club yet.</ChartEmpty>
          )}
        </ChartCard>
      </div>

      {/* ---------- One season: the switch first, then everything it changes ---------- */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-slate-500">Season</h2>
        <nav className="flex max-w-full overflow-x-auto [scrollbar-width:none] bg-white border border-slate-200 rounded-full p-1" aria-label="Season">
          {[...d.seasons].reverse().map((s) => (
            <Link
              key={s}
              href={`/admin/insights?season=${encodeURIComponent(s)}`}
              scroll={false}
              aria-current={s === d.season ? "page" : undefined}
              className={`shrink-0 px-3.5 py-1 rounded-full text-sm font-medium ${
                s === d.season ? "bg-navy-900 text-white" : "text-slate-600 hover:text-navy-900"
              }`}
            >
              {s}
            </Link>
          ))}
        </nav>
        <span className="text-xs text-slate-500">
          {d.seasonMatches} {d.seasonMatches === 1 ? "match" : "matches"} played
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Top try scorers"
          subtitle={`${d.season ?? ""} · ${d.seasonTries} tries recorded against a player`}
          table={{ columns: ["Player", "Tries"], rows: d.topTries.map((p) => [p.label, p.value]) }}
        >
          {d.topTries.length ? (
            <RankedBars items={d.topTries} unit="tries" total={d.seasonTries} label={`Top try scorers, ${d.season}`} />
          ) : (
            <ChartEmpty>No tries recorded against a player this season.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard
          title="Top points scorers"
          subtitle={`${d.season ?? ""} · tries, goals and drop goals`}
          table={{ columns: ["Player", "Points"], rows: d.topPoints.map((p) => [p.label, p.value]) }}
        >
          {d.topPoints.length ? (
            <RankedBars
              items={d.topPoints}
              unit="points"
              total={d.seasonPlayerPoints}
              label={`Top points scorers, ${d.season}`}
            />
          ) : (
            <ChartEmpty>No points recorded against a player this season.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard
          title="How the points were scored"
          subtitle={`${d.season ?? ""} · ${seasonPoints.toLocaleString("en-GB")} points from recorded scoring`}
          table={{
            columns: ["Scored by", "Points", "Share"],
            rows: d.pointsByType.map((p) => [
              p.label,
              p.value,
              `${seasonPoints ? Math.round((p.value / seasonPoints) * 100) : 0}%`,
            ]),
          }}
        >
          {seasonPoints ? (
            <SegmentedBar parts={scoringParts} unit="points" label={`Points by how they were scored, ${d.season}`} />
          ) : (
            <ChartEmpty>No scoring recorded for this season.</ChartEmpty>
          )}
        </ChartCard>

        <ChartCard
          title="What's on record"
          subtitle={`${d.season ?? ""} · of the ${d.seasonMatches} matches played`}
          table={{
            columns: ["Record", "Matches", "Of"],
            rows: [
              ["Team sheet entered", d.records.teamSheets, d.seasonMatches],
              ["Scoring entered", d.records.events, d.seasonMatches],
              ["Match sheet uploaded", d.records.matchSheets, d.seasonMatches],
            ],
          }}
        >
          {d.seasonMatches ? (
            <div className="grid gap-5">
              <Meter label="Team sheet entered" value={d.records.teamSheets} of={d.seasonMatches} unit="matches" />
              <Meter label="Scoring entered" value={d.records.events} of={d.seasonMatches} unit="matches" />
              <Meter label="Match sheet uploaded" value={d.records.matchSheets} of={d.seasonMatches} unit="matches" />
            </div>
          ) : (
            <ChartEmpty>No matches played this season.</ChartEmpty>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
