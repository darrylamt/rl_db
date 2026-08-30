import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClub } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { POSITIONS } from "@/lib/positions";
import { saveTeamSheet, submitTeamSheet, withdrawTeamSheet } from "../actions";

export const dynamic = "force-dynamic";

export default async function BuildTeamSheetPage({
  params,
  searchParams,
}: {
  params: { fixtureId: string };
  searchParams?: { error?: string; note?: string };
}) {
  const { teamId } = await requireClub();
  const supabase = createAdminClient();
  const fixtureId = params.fixtureId;

  const [{ data: fixture }, { data: squad }, { data: sheet }, { data: named }] =
    await Promise.all([
      supabase
        .from("fixtures")
        .select(
          "fixture_id, scheduled_date, scheduled_time, home_team_id, away_team_id, home:home_team_id(name), away:away_team_id(name), venue:venue_id(name), competition:competition_id(name, season)"
        )
        .eq("fixture_id", fixtureId)
        .maybeSingle(),
      supabase
        .from("players")
        .select("player_id, first_name, last_name, position, jersey_number, photo_url")
        .eq("team_id", teamId)
        .order("last_name"),
      supabase
        .from("team_sheets")
        .select("status, review_note, submitted_at")
        .eq("fixture_id", fixtureId)
        .eq("team_id", teamId)
        .maybeSingle(),
      supabase
        .from("match_lineups")
        .select("player_id, jersey_number, position, is_starter")
        .eq("fixture_id", fixtureId)
        .eq("team_id", teamId),
    ]);

  if (!fixture) notFound();
  const f = fixture as any;
  if (f.home_team_id !== teamId && f.away_team_id !== teamId) notFound();

  const status = (sheet as any)?.status ?? "draft";
  const locked = status === "submitted" || status === "approved";

  const namedBy = new Map(
    ((named ?? []) as any[]).map((l) => [l.player_id, l])
  );

  return (
    <div>
      <Link href="/club/team-sheets" className="text-sm text-navy-600 hover:underline">
        ← Team sheets
      </Link>

      <div className="mt-3 mb-5">
        <h1 className="font-display text-2xl font-bold text-navy-900">
          {f.home?.name} v {f.away?.name}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {[f.scheduled_date, f.scheduled_time?.slice(0, 5), f.venue?.name, f.competition?.name]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

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

      {status === "approved" && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm px-3 py-2.5 rounded mb-4">
          Approved by the federation. This is the side the recorder will work
          from — ask them to reopen it if something has to change.
        </div>
      )}
      {status === "submitted" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2.5 rounded mb-4 flex items-center justify-between gap-3 flex-wrap">
          <span>With the federation, waiting on approval.</span>
          <form action={withdrawTeamSheet.bind(null, fixtureId)}>
            <button className="text-xs font-medium px-3 py-1.5 rounded border border-amber-400 hover:bg-amber-100">
              Withdraw to edit
            </button>
          </form>
        </div>
      )}
      {status === "declined" && (
        <div className="bg-red-50 border border-red-200 text-red-900 text-sm px-3 py-2.5 rounded mb-4">
          Sent back{(sheet as any)?.review_note ? ` — ${(sheet as any).review_note}` : ""}. Make
          the change and submit it again.
        </div>
      )}

      <form action={saveTeamSheet.bind(null, fixtureId)}>
        <fieldset disabled={locked} className="disabled:opacity-60">
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 mb-4">
            {(squad ?? []).length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm">
                No players on your squad yet.{" "}
                <Link href="/club/players/new" className="text-navy-700 hover:underline">
                  Add one
                </Link>
                .
              </p>
            ) : (
              ((squad ?? []) as any[]).map((p) => {
                const on = namedBy.get(p.player_id);
                return (
                  <div
                    key={p.player_id}
                    className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                  >
                    <input
                      type="checkbox"
                      name={`picked:${p.player_id}`}
                      defaultChecked={!!on}
                      className="w-4 h-4 shrink-0"
                      aria-label={`Name ${p.first_name} ${p.last_name}`}
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-medium text-navy-900 truncate">
                        {p.first_name} {p.last_name}
                      </span>
                      {p.position && (
                        <span className="block text-xs text-slate-500">{p.position}</span>
                      )}
                    </span>

                    <input
                      type="number"
                      name={`jersey:${p.player_id}`}
                      min={1}
                      defaultValue={on?.jersey_number ?? p.jersey_number ?? ""}
                      placeholder="#"
                      className="w-14 px-2 py-1.5 rounded border border-slate-300 text-sm"
                      aria-label="Jersey number"
                    />

                    <select
                      name={`position:${p.player_id}`}
                      defaultValue={on?.position ?? p.position ?? ""}
                      className="px-2 py-1.5 rounded border border-slate-300 text-sm w-36"
                      aria-label="Position"
                    >
                      <option value="">— position —</option>
                      {POSITIONS.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        name={`bench:${p.player_id}`}
                        defaultChecked={on ? on.is_starter === false : false}
                        className="w-3.5 h-3.5"
                      />
                      Bench
                    </label>
                  </div>
                );
              })
            )}
          </div>

          {!locked && (squad ?? []).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2.5 rounded">
                Save side
              </button>
            </div>
          )}
        </fieldset>
      </form>

      {!locked && namedBy.size > 0 && (
        <form action={submitTeamSheet.bind(null, fixtureId)} className="mt-3">
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2.5 rounded">
            Submit to the federation
          </button>
          <p className="text-xs text-slate-500 mt-2">
            {namedBy.size} named. Save any changes first — submitting sends what
            is saved.
          </p>
        </form>
      )}
    </div>
  );
}
