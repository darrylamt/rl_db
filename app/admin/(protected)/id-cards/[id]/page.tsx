import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/admin/Breadcrumb";
import { createAdminClient } from "@/lib/supabase/server";
import { cardNumberFor } from "@/lib/idCard";
import { getSeasonState } from "@/lib/seasons";

export const dynamic = "force-dynamic";

/** One player's card, both sides, with downloads and a print link. */
export default async function IdCardPreview({ params }: { params: { id: string } }) {
  const supabase = createAdminClient();
  const [{ data: p }, { data: regs }, seasons] = await Promise.all([
    supabase.from("players").select("player_id, first_name, last_name, photo_url, position").eq("player_id", params.id).maybeSingle(),
    supabase
      .from("player_registrations")
      .select("season_year")
      .eq("player_id", params.id)
      .order("season_year", { ascending: false })
      .limit(1),
    getSeasonState(),
  ]);
  if (!p) notFound();

  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  const season = (regs ?? [])[0]?.season_year as number | undefined;
  const thisYear = new Date().getFullYear();
  const src = (side: string, download = false) =>
    `/api/admin/id-card/${p.player_id}?side=${side}${download ? "&download=1" : ""}`;

  const warnings = [
    !season || season < thisYear
      ? `Not registered for ${thisYear}${season ? ` (last registered ${season})` : ""}, so the card shows an old season.`
      : null,
    // Registered, but the season they are registered for has already ended.
    season && season >= thisYear && (seasons.every.find((s) => s.season === String(season))?.endsOn ?? "9999") < new Date().toISOString().slice(0, 10)
      ? `The ${season} season has ended, so this card's "valid until" date has passed. Register the player for the next season first.`
      : null,
    !p.photo_url ? "No photo on record: the card shows initials. Add a photo on the player's page first." : null,
    !p.position ? "No position on record." : null,
  ].filter(Boolean) as string[];

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <Breadcrumb crumbs={[{ label: "ID Cards", href: "/admin/id-cards" }, { label: name }]} />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy-900">{name}</h1>
          <p className="text-sm text-slate-500 font-mono">{cardNumberFor(p.player_id)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={src("front", true)} className="border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 rounded text-sm">
            Download front
          </a>
          <a href={src("back", true)} className="border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 rounded text-sm">
            Download back
          </a>
          <Link href={`/admin/id-cards/print?ids=${p.player_id}`} className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded text-sm font-medium">
            Print
          </Link>
          <Link href={`/admin/players/${p.player_id}`} className="text-sm text-navy-700 hover:underline px-2 py-2">
            Edit player
          </Link>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 text-sm px-3 py-2.5 rounded mb-5 space-y-1">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {(["front", "back"] as const).map((side) => (
          <figure key={side}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(side)} alt={`${name} ID card, ${side}`} className="w-full rounded-2xl shadow-lg border border-slate-200" />
            <figcaption className="text-xs text-slate-500 mt-2 capitalize">{side}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
