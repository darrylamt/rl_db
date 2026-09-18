import Link from "next/link";
import { ListHeader } from "@/components/admin/ListHeader";
import { findDuplicates, type PlayerRow } from "@/lib/duplicates";
import { mergePlayers } from "./actions";

export const dynamic = "force-dynamic";

function grade(p: PlayerRow) {
  const c = (p.category ?? "").replace(/_/g, " ");
  return c || "no grade";
}

/** The side with more history is the one worth keeping. */
function richer(a: PlayerRow, b: PlayerRow): PlayerRow {
  const score = (p: PlayerRow) =>
    p.appearances * 10 +
    p.events * 5 +
    (p.date_of_birth ? 3 : 0) +
    (p.team_id ? 2 : 0);
  return score(b) > score(a) ? b : a;
}

function Card({ p, keep }: { p: PlayerRow; keep: boolean }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        keep ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="font-medium text-navy-900">
        {p.first_name} {p.last_name}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">
        {[p.team_name ?? "no club", grade(p), p.playing_status]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="text-xs text-slate-500 mt-1">
        {p.appearances} appearance{p.appearances === 1 ? "" : "s"} ·{" "}
        {p.events} event{p.events === 1 ? "" : "s"} ·{" "}
        {p.date_of_birth ?? "no date of birth"}
      </p>
      <Link
        href={`/admin/players/${p.player_id}`}
        className="text-xs text-navy-700 hover:underline mt-1 inline-block"
      >
        Open this record →
      </Link>
    </div>
  );
}

export default async function DuplicatesPage({
  searchParams,
}: {
  searchParams?: { error?: string; note?: string; all?: string };
}) {
  const candidates = await findDuplicates();
  const showAll = searchParams?.all === "1";

  const likely = candidates.filter((c) => c.confidence >= 0.6);
  const maybe = candidates.filter((c) => c.confidence < 0.6);
  const shown = showAll ? candidates : likely;

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Duplicate players" eyebrow="REGISTER" />

      <p className="text-sm text-slate-500 -mt-3 mb-5 max-w-2xl">
        The same person on record twice. It happens when a youth player comes
        up to the senior side and the name is written a little differently the
        second time &mdash; their career then splits across two profiles, half
        the appearances on each, and neither one right.
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

      <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded mb-5">
        <strong>Nothing here merges on its own.</strong> Some of these are two
        real people &mdash; the register holds a Desmond Okyere Jnr and a
        Desmond Okyere Snr. Pairs that share a match, a conflicting date of
        birth, a different gender, or a Jnr/Snr are ruled out and never
        listed. The rest are put to you with the evidence.
      </div>

      <div className="flex gap-2 mb-5 text-sm">
        <Link
          href="/admin/duplicates"
          className={`px-3 py-1.5 rounded border ${
            !showAll
              ? "bg-navy-900 text-white border-navy-900"
              : "border-slate-300 text-slate-600"
          }`}
        >
          Likely ({likely.length})
        </Link>
        <Link
          href="/admin/duplicates?all=1"
          className={`px-3 py-1.5 rounded border ${
            showAll
              ? "bg-navy-900 text-white border-navy-900"
              : "border-slate-300 text-slate-600"
          }`}
        >
          Everything worth a look ({candidates.length})
        </Link>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-slate-500 text-sm">
          Nothing left to review.
        </div>
      ) : (
        <div className="grid gap-4">
          {shown.map((c) => {
            const keep = richer(c.a, c.b);
            const drop = keep.player_id === c.a.player_id ? c.b : c.a;
            return (
              <section
                key={`${c.a.player_id}-${c.b.player_id}`}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      c.confidence >= 0.8
                        ? "bg-red-100 text-red-800"
                        : c.confidence >= 0.6
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {Math.round(c.confidence * 100)}% likely the same person
                  </span>
                  <span className="text-xs text-slate-500">
                    {c.because.join(" · ")}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Card p={keep} keep />
                  <Card p={drop} keep={false} />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">
                    Merging moves every appearance, event, contract and
                    registration onto{" "}
                    <strong className="text-navy-900">
                      {keep.first_name} {keep.last_name}
                    </strong>
                    , then removes the other record.
                  </p>
                  <div className="flex gap-2">
                    <form
                      action={mergePlayers.bind(
                        null,
                        keep.player_id,
                        drop.player_id
                      )}
                    >
                      <button className="text-xs font-medium px-3 py-2 rounded bg-navy-900 hover:bg-navy-800 text-white whitespace-nowrap">
                        Merge into {keep.first_name}
                      </button>
                    </form>
                    <form
                      action={mergePlayers.bind(
                        null,
                        drop.player_id,
                        keep.player_id
                      )}
                    >
                      <button className="text-xs px-3 py-2 rounded border border-slate-300 text-slate-700 hover:bg-slate-50 whitespace-nowrap">
                        Other way round
                      </button>
                    </form>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!showAll && maybe.length > 0 && (
        <p className="text-xs text-slate-400 mt-4">
          {maybe.length} weaker match{maybe.length === 1 ? "" : "es"} hidden.
          Most of those are two different people with similar names.
        </p>
      )}
    </div>
  );
}
