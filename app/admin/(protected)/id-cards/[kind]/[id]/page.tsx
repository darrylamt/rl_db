import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/admin/Breadcrumb";
import { CARD_KINDS, KIND_LABEL, type CardKind, getIdCardData } from "@/lib/idCard";

export const dynamic = "force-dynamic";

/** Where each kind of person is edited, for fixing what the card shows. */
const EDIT: Record<CardKind, (id: string) => string> = {
  player: (id) => `/admin/players/${id}`,
  coach: (id) => `/admin/coaches/${id}`,
  official: (id) => `/admin/officials/${id}`,
  management: (id) => `/admin/people/${id}`,
  staff: (id) => `/admin/accreditations/${id}`,
};

/** One card, both sides, with downloads and a print link. */
export default async function IdCardPreview({ params }: { params: { kind: string; id: string } }) {
  if (!CARD_KINDS.includes(params.kind as CardKind)) notFound();
  const kind = params.kind as CardKind;
  const d = await getIdCardData(kind, params.id);
  if (!d) notFound();

  const src = (side: string, download = false) =>
    `/api/admin/id-card/${kind}/${d.id}?side=${side}${download ? "&download=1" : ""}`;

  const warnings = [
    d.revoked ? "This person is marked inactive or revoked. Their verify page will say the card is not valid." : null,
    d.expired
      ? kind === "player"
        ? "Not registered for a season that is still running, so the card's \"valid until\" date has passed. Register the player for the next season first."
        : "The card's \"valid until\" date has passed."
      : null,
    !d.photo ? "No photo could be loaded, so the card shows initials. Add or re-upload a photo first." : null,
  ].filter(Boolean) as string[];

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <Breadcrumb crumbs={[{ label: "ID Cards", href: `/admin/id-cards?kind=${kind}` }, { label: d.name || KIND_LABEL[kind] }]} />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{d.theme.title.toLowerCase()}</p>
          <h1 className="font-display text-3xl font-bold text-navy-900">{d.name}</h1>
          <p className="text-sm text-slate-500 font-mono">{d.cardNumber}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={src("front", true)} className="border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 rounded text-sm">
            Download front
          </a>
          <a href={src("back", true)} className="border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 rounded text-sm">
            Download back
          </a>
          <Link href={`/admin/id-cards/print?ids=${kind}:${d.id}`} className="bg-navy-900 hover:bg-navy-800 text-white px-4 py-2 rounded text-sm font-medium">
            Print
          </Link>
          <Link href={EDIT[kind](d.id)} className="text-sm text-navy-700 hover:underline px-2 py-2">
            Edit details
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
            <img src={src(side)} alt={`${d.name} ID card, ${side}`} className="w-full rounded-2xl shadow-lg border border-slate-200" />
            <figcaption className="text-xs text-slate-500 mt-2 capitalize">{side}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
