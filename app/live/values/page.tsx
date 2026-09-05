import Link from "next/link";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { getPlayerValues, type ValueGroup } from "@/lib/playerValue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Player values — RLFG Live",
  description:
    "What every registered player is worth, worked out from their recorded record.",
};

const GROUPS: { key: ValueGroup | "all"; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "spine", label: "Spine" },
  { key: "outside", label: "Outside backs" },
  { key: "forward", label: "Forwards" },
  { key: "utility", label: "Unlisted" },
];

const GROUP_NOTE: Record<ValueGroup, string> = {
  spine: "Hookers, halves and fullbacks — the positions that touch the ball most.",
  outside: "Wings and centres.",
  forward: "Props, second-rowers and loose forwards.",
  utility:
    "Players whose position has not been entered yet. They are valued against everybody until it is.",
};

export default async function ValuesPage({
  searchParams,
}: {
  searchParams?: { group?: string };
}) {
  const supabase = createPublicClient();

  const [values, { data: players }, { data: teams }] = await Promise.all([
    getPlayerValues(),
    supabase
      .from("public_players")
      .select("player_id, first_name, last_name, position, photo_url, team_id, playing_status")
      .limit(1000),
    supabase.from("teams").select("team_id, name, logo_url"),
  ]);

  const club = new Map(
    ((teams ?? []) as any[]).map((t) => [t.team_id, t])
  );

  const group = (GROUPS.find((g) => g.key === searchParams?.group)?.key ??
    "all") as ValueGroup | "all";

  const rows = ((players ?? []) as any[])
    .map((p) => ({ ...p, v: values.get(p.player_id) }))
    .filter((r) => r.v)
    // Somebody no longer playing is not what a value list is for.
    .filter((r) => r.playing_status === "active")
    .filter((r) => group === "all" || r.v.group === group)
    .sort((a, b) => b.v.value - a.v.value);

  const top = rows.slice(0, 50);

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl leading-tight">
          Player values
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          What the record says each player is worth, measured against others in
          the same position. A short record counts for less than a long one, so
          nobody is judged on a single afternoon.
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-6">
        {GROUPS.map((g) => {
          const on = group === g.key;
          return (
            <Link
              key={g.key}
              href={g.key === "all" ? "/live/values" : `/live/values?group=${g.key}`}
              className={`px-3 py-1.5 rounded-full text-xs border transition ${
                on
                  ? "bg-ghanaYellow-500 text-black border-ghanaYellow-500 font-semibold"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {g.label}
            </Link>
          );
        })}
      </div>

      {group !== "all" && (
        <p className="text-[11px] text-slate-500 -mt-3 mb-5">
          {GROUP_NOTE[group]}
        </p>
      )}

      {top.length === 0 ? (
        <p className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-10 text-center text-slate-400 text-sm">
          Nobody to value here yet.
        </p>
      ) : (
        <ol className="space-y-2">
          {top.map((r, i) => {
            const t = r.team_id ? club.get(r.team_id) : null;
            const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
            return (
              <li key={r.player_id}>
                <Link
                  href={`/live/player/${r.player_id}`}
                  className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/25 transition"
                >
                  <span className="w-6 shrink-0 text-center font-display tabular-nums text-sm text-slate-500">
                    {i + 1}
                  </span>

                  <Avatar src={r.photo_url} name={name} size={40} rounded="none" className="rounded-xl" />

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">
                      {name}
                    </span>
                    <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                      {t?.logo_url && (
                        <Avatar src={t.logo_url} name={t.name} size={14} contain />
                      )}
                      <span className="text-[11px] text-slate-500 truncate">
                        {[t?.name, r.position].filter(Boolean).join(" · ") ||
                          "No club"}
                      </span>
                    </span>
                  </span>

                  <span className="text-right shrink-0">
                    <span className="block font-display text-xl text-ghanaYellow-500 tabular-nums leading-none">
                      {r.v.value}
                    </span>
                    <span
                      className={`block text-[10px] mt-0.5 ${
                        r.v.confidence === "good"
                          ? "text-emerald-400/80"
                          : r.v.confidence === "fair"
                          ? "text-slate-500"
                          : "text-amber-400/80"
                      }`}
                    >
                      {r.v.appearances} app{r.v.appearances === 1 ? "" : "s"}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-xs text-slate-500 mt-8">
        Worked out from recorded match data — scoring, game time and the
        strength of the sides a player actually played in.{" "}
        <Link href="/live/records" className="text-ghanaYellow-500 hover:underline">
          The record book
        </Link>
      </p>
    </>
  );
}
