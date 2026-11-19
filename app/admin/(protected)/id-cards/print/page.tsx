import Link from "next/link";
import { CARD_KINDS, type CardKind } from "@/lib/idCard";
import { PrintCardsButton } from "./PrintCardsButton";

export const dynamic = "force-dynamic";

/**
 * A print sheet: each card's front beside its back at true size
 * (85.6 × 54 mm), outlined to cut along. Five cards to an A4 page, any mix
 * of groups. The admin sidebar is hidden when printing.
 *
 * ids=kind:id, repeated or comma-separated. A bare id is a player, which is
 * how the first version of this page was linked.
 */
export default function PrintIdCards({ searchParams }: { searchParams?: { ids?: string | string[] } }) {
  const raw = searchParams?.ids;
  const cards = (Array.isArray(raw) ? raw : raw ? raw.split(",") : [])
    .map((s) => {
      const [a, b] = s.includes(":") ? s.split(":") : ["player", s];
      return { kind: a as CardKind, id: (b ?? "").replace(/[^a-f0-9-]/gi, "") };
    })
    .filter((c) => CARD_KINDS.includes(c.kind) && c.id)
    .slice(0, 100);

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
        <p className="text-sm text-slate-500">Nobody chosen. Go back and tick some people.</p>
      ) : (
        cards.map((c) => (
          <div key={`${c.kind}:${c.id}`} className="idc-row">
            {(["front", "back"] as const).map((side) => (
              <div key={side} className="idc">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/admin/id-card/${c.kind}/${c.id}?side=${side}`} alt={`ID card ${side}`} />
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
