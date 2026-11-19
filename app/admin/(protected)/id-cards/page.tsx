import Link from "next/link";
import { ListHeader } from "@/components/admin/ListHeader";
import { createAdminClient } from "@/lib/supabase/server";
import { CARD_KINDS, KIND_LABEL, STAFF_CATEGORIES, type CardKind, cardNumberFor } from "@/lib/idCard";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string; sub: string; badge?: { text: string; tone: "ok" | "warn" | "muted" }; checked: boolean; letter?: string };

/**
 * ID cards for everyone on a match day: players, coaches, match officials,
 * federation management, and staff & media. Pick a tab, find people, tick
 * them and print. Issued by the federation only.
 */
export default async function IdCardsPage({
  searchParams,
}: {
  searchParams?: { kind?: string; team?: string; q?: string };
}) {
  const kind: CardKind = CARD_KINDS.includes(searchParams?.kind as CardKind) ? (searchParams!.kind as CardKind) : "player";
  const supabase = createAdminClient();
  const team = searchParams?.team ?? "";
  const q = (searchParams?.q ?? "").trim();
  // Each word must match part of the name, so "Darryl Amoatey" works.
  const words = q.split(/\s+/).map((w) => w.replace(/[%,()]/g, "")).filter(Boolean);
  const thisYear = new Date().getFullYear();

  const { data: teams } = await supabase.from("teams").select("team_id, name").order("name");
  const teamName = (teams ?? []).find((t: any) => t.team_id === team)?.name;
  const clubFilter = kind === "player" || kind === "coach" || kind === "staff";
  const mustFilter = kind === "player"; // 500 players: ask for a club or a name first

  let rows: Row[] = [];
  let widened = false;

  if (kind === "player" && (team || words.length)) {
    const find = async (byTeam: boolean) => {
      let query = supabase.from("players").select("player_id, first_name, last_name, position, team:team_id(name)").order("last_name").limit(200);
      if (byTeam && team) query = query.eq("team_id", team);
      for (const w of words) query = query.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%`);
      return (await query).data ?? [];
    };
    let players: any[] = await find(true);
    // A name that isn't at the chosen club is looked for everywhere.
    if (!players.length && team && words.length) {
      players = await find(false);
      widened = players.length > 0;
    }
    const ids = players.map((p) => p.player_id);
    const { data: regs } = ids.length
      ? await supabase.from("player_registrations").select("player_id, season_year").in("player_id", ids)
      : { data: [] as any[] };
    const latest = new Map<string, number>();
    for (const r of (regs ?? []) as any[]) latest.set(r.player_id, Math.max(latest.get(r.player_id) ?? 0, r.season_year));
    rows = players.map((p) => {
      const season = latest.get(p.player_id);
      const club = Array.isArray(p.team) ? p.team[0]?.name : p.team?.name;
      const current = !!season && season >= thisYear;
      return {
        id: p.player_id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        sub: [club ?? "Unattached", p.position].filter(Boolean).join(" · "),
        badge: season ? { text: `Registered ${season}`, tone: current ? "ok" : "warn" } : { text: "Not registered", tone: "muted" },
        checked: current,
      };
    });
  } else if (kind === "coach") {
    let query = supabase.from("coaches").select("coach_id, first_name, last_name, role, status, team:team_id(name)").order("last_name");
    if (team) query = query.eq("team_id", team);
    for (const w of words) query = query.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%`);
    rows = ((await query).data ?? []).map((c: any) => ({
      id: c.coach_id,
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
      sub: [(Array.isArray(c.team) ? c.team[0]?.name : c.team?.name) ?? "Federation", c.role?.replace(/_/g, " ")].filter(Boolean).join(" · "),
      badge: String(c.status ?? "active") === "active" ? undefined : { text: "Inactive", tone: "muted" },
      checked: String(c.status ?? "active") === "active",
    }));
  } else if (kind === "official") {
    let query = supabase.from("officials").select("official_id, first_name, last_name, role, level, status").order("last_name");
    for (const w of words) query = query.or(`first_name.ilike.%${w}%,last_name.ilike.%${w}%`);
    rows = ((await query).data ?? []).map((o: any) => ({
      id: o.official_id,
      name: `${o.first_name ?? ""} ${o.last_name ?? ""}`.trim(),
      sub: [o.role?.replace(/_/g, " "), o.level].filter(Boolean).join(" · ") || "Match official",
      badge: String(o.status ?? "active") === "active" ? undefined : { text: "Inactive", tone: "muted" },
      checked: String(o.status ?? "active") === "active",
    }));
  } else if (kind === "management") {
    let query = supabase.from("people").select("person_id, name, role, group_name, status").order("group_name").order("sort_order");
    for (const w of words) query = query.ilike("name", `%${w}%`);
    rows = ((await query).data ?? []).map((m: any) => ({
      id: m.person_id,
      name: m.name,
      sub: [m.role, m.group_name === "board" ? "The Board" : m.group_name === "committee" ? "Management Committee" : m.group_name].filter(Boolean).join(" · "),
      checked: m.status !== "archived",
    }));
  } else if (kind === "staff") {
    let query = supabase.from("accreditations").select("accreditation_id, full_name, role, category, organisation, status, valid_until, team:team_id(name)").order("full_name");
    if (team) query = query.eq("team_id", team);
    for (const w of words) query = query.ilike("full_name", `%${w}%`);
    rows = ((await query).data ?? []).map((a: any) => {
      const cat = STAFF_CATEGORIES.find((c) => c.key === a.category)?.label ?? "Staff";
      const org = (Array.isArray(a.team) ? a.team[0]?.name : a.team?.name) ?? a.organisation ?? "Federation";
      return {
        id: a.accreditation_id,
        name: a.full_name,
        sub: [a.role, cat, org].filter(Boolean).join(" · "),
        badge: a.status === "revoked" ? { text: "Revoked", tone: "muted" } : undefined,
        checked: a.status !== "revoked",
        letter: "S",
      };
    });
  }

  const tone = { ok: "bg-emerald-50 text-emerald-800", warn: "bg-amber-50 text-amber-800", muted: "bg-slate-100 text-slate-500" };
  const showList = !mustFilter || team || words.length;

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="ID Cards" eyebrow="ACCREDITATION" />
      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        Bank-card size and print-ready, each group in its own colours. The back carries a QR code that shows whether the
        card is still valid. Only the federation can issue cards.
      </p>

      {/* One tab per group */}
      <nav className="flex flex-wrap gap-1 mb-5 border-b border-slate-200">
        {CARD_KINDS.map((k) => (
          <Link
            key={k}
            href={`/admin/id-cards?kind=${k}`}
            className={`px-3.5 py-2 text-sm -mb-px border-b-2 ${k === kind ? "border-navy-900 text-navy-900 font-medium" : "border-transparent text-slate-500 hover:text-navy-900"}`}
          >
            {KIND_LABEL[k]}
          </Link>
        ))}
      </nav>

      <form className="flex flex-wrap items-end gap-3 mb-5" method="get">
        <input type="hidden" name="kind" value={kind} />
        {clubFilter && (
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
        )}
        <label className="text-sm">
          <span className="block text-xs text-slate-500 mb-1">Name</span>
          <input name="q" defaultValue={q} placeholder="Search by name" className="border border-slate-300 rounded px-3 py-2 text-sm bg-white" />
        </label>
        <button className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded text-sm font-medium">Show</button>
        {kind === "staff" && (
          <Link href="/admin/accreditations/new" className="ml-auto border border-navy-900 text-navy-900 hover:bg-navy-50 px-4 py-2 rounded text-sm font-medium">
            + Add someone
          </Link>
        )}
      </form>

      {kind === "staff" && (
        <p className="text-xs text-slate-500 -mt-2 mb-4 max-w-2xl">
          Photographers, social media managers, team managers, physios, volunteers and anyone else who needs a pass. Add them
          here, then print their card.
        </p>
      )}

      {!showList ? (
        <p className="text-sm text-slate-500">Pick a club or search for a player.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {kind === "staff" && !q && !team ? "Nobody added yet. Use “+ Add someone”." : "Nobody found."}
        </p>
      ) : (
        <form method="get" action="/admin/id-cards/print">
          {widened && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              Nobody called &ldquo;{q}&rdquo; at {teamName ?? "that club"}, so these are from every club.
            </p>
          )}
          <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
            {rows.map((r) => (
              <label key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" name="ids" value={`${kind}:${r.id}`} defaultChecked={r.checked} className="h-4 w-4" />
                <span className="flex-1 min-w-0">
                  <span className="font-medium text-navy-900">{r.name}</span>
                  {r.sub && <span className="text-slate-500"> · {r.sub}</span>}
                </span>
                <span className="hidden sm:inline text-xs text-slate-400 font-mono">{cardNumberFor(r.id, kind, r.letter)}</span>
                {r.badge && <span className={`text-xs px-2 py-0.5 rounded ${tone[r.badge.tone]}`}>{r.badge.text}</span>}
                {kind === "staff" && (
                  <Link href={`/admin/accreditations/${r.id}`} className="text-xs text-slate-500 hover:underline">
                    Edit
                  </Link>
                )}
                <Link href={`/admin/id-cards/${kind}/${r.id}`} className="text-xs text-navy-700 hover:underline">
                  Preview
                </Link>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2.5 rounded text-sm font-medium">Print selected cards</button>
            <span className="text-xs text-slate-500">
              {kind === "player" ? "Players registered for this season are ticked to start with." : "Active people are ticked to start with."}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
