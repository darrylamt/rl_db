import Link from "next/link";
import type { Metadata } from "next";
import { createPublicClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import { Pagination } from "@/components/admin/Pagination";
import {
  getPlayerValues,
  type ValueGroup,
  type ValueGrade,
} from "@/lib/playerValue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Player values — RLFG Live",
  description:
    "What every registered player is worth, worked out from their recorded record.",
};

const GRADES: { key: ValueGrade; label: string }[] = [
  { key: "senior_men", label: "Men" },
  { key: "senior_women", label: "Women" },
  { key: "youth", label: "Youth" },
];

const GROUPS: { key: ValueGroup | "all"; label: string }[] = [
  { key: "all", label: "Every position" },
  { key: "spine", label: "Spine" },
  { key: "outside", label: "Outside backs" },
  { key: "forward", label: "Forwards" },
  { key: "utility", label: "Unlisted" },
];

const PAGE_SIZE = 25;

export default async function ValuesPage({
  searchParams,
}: {
  searchParams?: { grade?: string; group?: string; page?: string };
}) {
  const supabase = createPublicClient();

  const [values, { data: players }, { data: teams }] = await Promise.all([
    getPlayerValues(),
    supabase
      .from("public_players")
      .select("player_id, first_name, last_name, position, photo_url, team_id")
      .limit(1000),
    supabase.from("teams").select("team_id, name, logo_url"),
  ]);

  const club = new Map(((teams ?? []) as any[]).map((t) => [t.team_id, t]));

  const grade = (GRADES.find((g) => g.key === searchParams?.grade)?.key ??
    "senior_men") as ValueGrade;
  const group = (GROUPS.find((g) => g.key === searchParams?.group)?.key ??
    "all") as ValueGroup | "all";
  const page = Math.max(1, parseInt(searchParams?.page ?? "1", 10) || 1);

  const withValue = ((players ?? []) as any[])
    .map((p) => ({ ...p, v: values.get(p.player_id) }))
    .filter((r) => r.v);

  // Deliberately not filtered on playing_status. Every women's and youth
  // player on the register is marked inactive — a leftover of how they were
  // imported rather than a statement that they have stopped playing — and
  // filtering on it hid all 336 of them.
  const inGrade = withValue.filter((r) => r.v.grade === grade);
  const rows = inGrade
    .filter((r) => group === "all" || r.v.group === group)
    .sort((a, b) => b.v.value - a.v.value);

  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const offset = (page - 1) * PAGE_SIZE;

  const href = (next: { grade?: ValueGrade; group?: string }) => {
    const p = new URLSearchParams();
    const g = next.grade ?? grade;
    const gr = "group" in next ? next.group : group;
    if (g !== "senior_men") p.set("grade", g);
    if (gr && gr !== "all") p.set("group", gr);
    const q = p.toString();
    return q ? `/live/values?${q}` : "/live/values";
  };

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl leading-tight">
          Player values
        </h1>
        <p className="text-slate-400 text-sm mt-2 max-w-2xl">
          What the record says each player is worth, measured against others in
          the same competition and position. A short record counts for less
          than a long one, so nobody is judged on a single afternoon.
        </p>
      </div>

      {/* The women's game has nine recorded matches to the men's two hundred,
          so these are separate ladders rather than one. */}
      <div className="flex bg-neutral-900 border border-white/10 rounded-full p-1 mb-3 max-w-sm">
        {GRADES.map((g) => {
          const on = grade === g.key;
          const n = withValue.filter((r) => r.v.grade === g.key).length;
          return (
            <Link
              key={g.key}
              href={href({ grade: g.key, group: "all" })}
              className={`flex-1 text-center text-sm font-medium rounded-full py-1.5 transition ${
                on ? "bg-white text-black" : "text-slate-300 hover:text-white"
              }`}
            >
              {g.label}
              {n > 0 && (
                <span
                  className={`ml-1.5 text-xs tabular-nums ${
                    on ? "text-black/50" : "text-slate-500"
                  }`}
                >
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex gap-1.5 flex-wrap mb-6">
        {GROUPS.filter(
          (g) =>
            g.key === "all" ||
            inGrade.some((r) => r.v.group === g.key)
        ).map((g) => {
          const on = group === g.key;
          return (
            <Link
              key={g.key}
              href={href({ group: g.key })}
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

      {rows.length === 0 ? (
        <p className="bg-neutral-900 border border-white/10 rounded-xl px-4 py-10 text-center text-slate-400 text-sm">
          Nobody to value here yet.
        </p>
      ) : (
        <>
          <ol className="space-y-2">
            {shown.map((r, i) => {
              const t = r.team_id ? club.get(r.team_id) : null;
              const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim();
              return (
                <li key={r.player_id}>
                  <Link
                    href={`/live/player/${r.player_id}`}
                    className="flex items-center gap-3 bg-neutral-900 border border-white/10 rounded-xl px-3 py-2.5 hover:border-white/25 transition"
                  >
                    <span className="w-7 shrink-0 text-center font-display tabular-nums text-sm text-slate-500">
                      {offset + i + 1}
                    </span>

                    <Avatar
                      src={r.photo_url}
                      name={name}
                      size={40}
                      rounded="none"
                      className="rounded-xl"
                    />

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

          {rows.length > PAGE_SIZE && (
            <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} />
          )}
        </>
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
