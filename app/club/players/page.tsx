import Link from "next/link";
import { GRADES, isGrade, gradeLabel } from "@/lib/grades";
import { Avatar } from "@/components/Avatar";
import { requireClub } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function ClubSquadPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { teamId } = await requireClub();
  const q = (first(searchParams?.q) ?? "").trim();
  const only = first(searchParams?.only) || "";
  const grade = first(searchParams?.grade) || "";

  const supabase = createAdminClient();
  let query = supabase
    .from("players")
    .select(
      "player_id, first_name, last_name, position, jersey_number, photo_url, date_of_birth, is_captain, playing_status, approval_status, review_note, category"
    )
    .eq("team_id", teamId)
    .order("last_name");

  if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`);

  const { data, error } = await query;
  let players = data ?? [];

  // A club's men, women and juniors are one list until this is chosen.
  if (grade) players = players.filter((p: any) => isGrade(p.category, grade));

  if (only === "no-position") players = players.filter((p: any) => !p.position);
  if (only === "no-photo") players = players.filter((p: any) => !p.photo_url);

  const total = (data ?? []).length;
  const missingPosition = (data ?? []).filter((p: any) => !p.position).length;
  const missingPhoto = (data ?? []).filter((p: any) => !p.photo_url).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Squad</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {total} player{total === 1 ? "" : "s"} on your books.
          </p>
        </div>
        <Link
          href="/club/players/new"
          className="bg-navy-900 hover:bg-navy-800 text-white text-sm font-medium px-4 py-2 rounded"
        >
          Add player
        </Link>
      </div>

      {/* What is still missing, as something you can act on rather than a
          number to admire. */}
      {(missingPosition > 0 || missingPhoto > 0) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {missingPosition > 0 && (
            <Link
              href={only === "no-position" ? "/club/players" : "/club/players?only=no-position"}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                only === "no-position"
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-400"
              }`}
            >
              {missingPosition} without a position
            </Link>
          )}
          {missingPhoto > 0 && (
            <Link
              href={only === "no-photo" ? "/club/players" : "/club/players?only=no-photo"}
              className={`text-xs px-3 py-1.5 rounded-full border ${
                only === "no-photo"
                  ? "bg-navy-900 text-white border-navy-900"
                  : "bg-slate-100 text-slate-700 border-slate-200 hover:border-slate-400"
              }`}
            >
              {missingPhoto} without a photo
            </Link>
          )}
        </div>
      )}

      <form className="mb-4 flex flex-wrap items-end gap-2 bg-white border border-slate-200 rounded-lg p-3">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search your squad…"
          className="flex-1 min-w-[12rem] px-3 py-1.5 rounded border border-slate-300 text-sm"
        />
        <select
          name="grade"
          defaultValue={grade}
          className="px-3 py-1.5 rounded border border-slate-300 bg-white text-sm"
          aria-label="Grade"
        >
          <option value="">All grades</option>
          {GRADES.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        {only && <input type="hidden" name="only" value={only} />}
        <button className="px-3 py-1.5 rounded bg-navy-900 text-white text-xs font-medium">
          Search
        </button>
        {(q || only || grade) && (
          <Link href="/club/players" className="text-xs text-slate-500 hover:underline">
            clear
          </Link>
        )}
      </form>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      {players.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-500">
          {total === 0 ? (
            <>
              No players on record yet.{" "}
              <Link href="/club/players/new" className="text-navy-700 hover:underline">
                Add your first →
              </Link>
            </>
          ) : (
            "Nothing matches that."
          )}
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((p: any) => (
            <li key={p.player_id}>
              <Link
                href={`/club/players/${p.player_id}`}
                className="flex items-center gap-3 bg-white border border-slate-200 hover:border-navy-300 rounded-lg px-3 py-2.5"
              >
                <Avatar
                  src={p.photo_url}
                  name={`${p.first_name ?? ""} ${p.last_name ?? ""}`}
                  size={40}
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-navy-900 truncate">
                    {p.first_name} {p.last_name}
                    {p.is_captain && (
                      <span className="ml-1.5 bg-gold-100 text-gold-800 text-[10px] px-1.5 py-0.5 rounded uppercase">
                        Capt
                      </span>
                    )}
                    {/* Where a submission stands. Approved is the norm and
                        needs no badge. */}
                    {p.approval_status === "pending" && (
                      <span className="ml-1.5 bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded uppercase">
                        Awaiting approval
                      </span>
                    )}
                    {p.approval_status === "declined" && (
                      <span className="ml-1.5 bg-red-100 text-red-800 text-[10px] px-1.5 py-0.5 rounded uppercase">
                        Declined
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[gradeLabel(p.category), p.position].filter(Boolean).join(" · ") || (
                      <span className="text-amber-700">position needed</span>
                    )}
                    {p.jersey_number != null && ` · #${p.jersey_number}`}
                  </span>
                  {p.approval_status === "declined" && p.review_note && (
                    <span className="block text-xs text-red-700 mt-0.5">
                      {p.review_note}
                    </span>
                  )}
                </span>
                <span className="text-slate-300 text-xs shrink-0">edit →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
