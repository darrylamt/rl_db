import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { PrintCardsButton } from "./PrintCardsButton";

export const dynamic = "force-dynamic";

/**
 * A print sheet: each card's front beside its back at true size
 * (85.6 × 54 mm), outlined to cut along. Five cards to an A4 page.
 * The admin sidebar is hidden when printing.
 */
export default async function PrintIdCards({ searchParams }: { searchParams?: { ids?: string | string[] } }) {
  const raw = searchParams?.ids;
  const ids = (Array.isArray(raw) ? raw : raw ? raw.split(",") : [])
    .map((s) => s.replace(/[^a-f0-9-]/gi, ""))
    .filter(Boolean)
    .slice(0, 100);
  const { data } = ids.length
    ? await createAdminClient().from("players").select("player_id, first_name, last_name").in("player_id", ids)
    : { data: [] as any[] };
  const names = new Map<string, string>(
    (data ?? []).map((p: any) => [p.player_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()])
  );
  const cards = ids.filter((id) => names.has(id));

  return (
    <div className="p-4 md:p-8 print:p-0">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print { body { background: #fff !important; } }
        .idc-row { display: flex; gap: 6mm; margin-bottom: 5mm; break-inside: avoid; }
        .idc { width: 85.6mm; height: 53.98mm; border: 0.2mm solid #cbd5e1; border-radius: 3.2mm; overflow: hidden; flex-shrink: 0; }
        .idc img { width: 100%; height: 100%; display: block; }
      `}</style>

      <div className="print:hidden flex flex-wrap items-center gap-3 mb-6">
        <Link href="/admin/id-cards" className="text-sm text-navy-700 hover:underline">
          ← ID Cards
        </Link>
        <span className="text-sm text-slate-500">
          {cards.length} card{cards.length === 1 ? "" : "s"}, front beside back, at true size.
        </span>
        {cards.length > 0 && <PrintCardsButton />}
      </div>

      {cards.length === 0 ? (
        <p className="text-sm text-slate-500">No players chosen. Go back and tick some.</p>
      ) : (
        cards.map((id) => (
          <div key={id} className="idc-row">
            {(["front", "back"] as const).map((side) => (
              <div key={side} className="idc">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/id-card/${id}?side=${side}`} alt={`${names.get(id)} ${side}`} />
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
