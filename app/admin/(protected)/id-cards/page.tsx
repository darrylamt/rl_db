import Link from "next/link";
import { ListHeader } from "@/components/admin/ListHeader";
import { createAdminClient } from "@/lib/supabase/server";
import { cardNumberFor } from "@/lib/idCard";

export const dynamic = "force-dynamic";

/**
 * ID cards: pick a club (or search), tick players, print their cards.
 * Issued by the federation only; this whole area is federation-only.
 */
export default async function IdCardsPage({
  searchParams,
}: {
  searchParams?: { team?: string; q?: string };
}) {
  const supabase = createAdminClient();
  const team = searchParams?.team ?? "";
  const q = (searchParams?.q ?? "").trim();
  // Each word must match a first or last name, so "Darryl Amoatey" works.
  const words = q.split(/\s+/).map((w) => w.replace(/[%,()]/g, "")).filter(Boolean);

  const { data: teams } = await supabase.from("teams").select("team_id, name").order("name");

  const find = async (byTeam: boolean) => {
    let query = supabase
      .from("players")
      .select("player_id, first_name, last_name, position, team:team_id(name)")
      .order("last_name")
      .limit(200);
    if (byTeam && team) query = query.eq("team_id", team);
    for (const w of words) query = query.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%`);
    return (await query).data ?? [];
  };

  let players: any[] = [];
  // A name that isn't at the chosen club is looked for everywhere, and the
  // page says so, rather than reporting nobody.
  let widened = false;
  if (team || words.length) {
    players = await find(true);
    if (!players.length && team && words.length) {
      players = await find(false);
      widened = players.length > 0;
    }
  }
  const teamName = (teams ?? []).find((t: any) => t.team_id === team)?.name;

  // The season each player last registered for, so an unregistered player's
  // card isn't printed by mistake.
  const ids = players.map((p) => p.player_id);
  const { data: regs } = ids.length
    ? await supabase.from("player_registrations").select("player_id, season_year").in("player_id", ids)
    : { data: [] as any[] };
  const latest = new Map<string, number>();
  for (const r of (regs ?? []) as any[]) {
    latest.set(r.player_id, Math.max(latest.get(r.player_id) ?? 0, r.season_year));
  }
  const thisYear = new Date().getFullYear();

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="ID Cards" eyebrow="PLAYERS" />
      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        Bank-card size and print-ready. The back carries a QR code to the player&rsquo;s live profile, so match
        officials can check their club and any suspension on the day. Only the federation can issue cards.
      </p>

      <form className="flex flex-wrap items-end gap-3 mb-5" method="get">
        <label className="text-sm">
          <span className="block text-xs text-slate-500 mb-1">Club</span>
          <select name="team" defaultValue={team} className="border border-slate-300 rounded px-3 py-2 text-sm bg-white min-w-[14rem]">
            <option value="">Any club</option>
            {(teams ?? []).map((t: any) => (
              <option key={t.team_id} value={t.team_id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-slate-500 mb-1">Name</span>
          <input name="q" defaultValue={q} placeholder="Search a player" className="border border-slate-300 rounded px-3 py-2 text-sm bg-white" />
        </label>
        <button className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded text-sm font-medium">Show players</button>
      </form>

      {!team && !q ? (
        <p className="text-sm text-slate-500">Pick a club or search for a player.</p>
      ) : players.length === 0 ? (
        <p className="text-sm text-slate-500">No players found.</p>
      ) : (
        <form method="get" action="/admin/id-cards/print">
          {widened && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              Nobody called &ldquo;{q}&rdquo; at {teamName ?? "that club"}, so these are from every club.
            </p>
          )}
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {players.map((p) => {
              const season = latest.get(p.player_id);
              const club = Array.isArray(p.team) ? p.team[0]?.name : p.team?.name;
              const current = !!season && season >= thisYear;
              return (
                <label key={p.player_id} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" name="ids" value={p.player_id} defaultChecked={current} className="h-4 w-4" />
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-navy-900">
                      {p.first_name} {p.last_name}
                    </span>
                    <span className="text-slate-500">
                      {" "}
                      · {club ?? "Unattached"}
                      {p.position ? ` · ${p.position}` : ""}
                    </span>
                  </span>
                  <span className="hidden sm:inline text-xs text-slate-400 font-mono">{cardNumberFor(p.player_id)}</span>
                  {season ? (
                    <span className={`text-xs px-2 py-0.5 rounded ${current ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      Registered {season}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">Not registered</span>
                  )}
                  <Link href={`/admin/id-cards/${p.player_id}`} className="text-xs text-navy-700 hover:underline">
                    Preview
                  </Link>
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2.5 rounded text-sm font-medium">Print selected cards</button>
            <span className="text-xs text-slate-500">Players registered for this season are ticked to start with.</span>
          </div>
        </form>
      )}
    </div>
  );
}
