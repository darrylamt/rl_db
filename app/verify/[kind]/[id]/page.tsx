import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getIdCardData, type CardKind } from "@/lib/idCard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify an RLFG card",
  robots: { index: false, follow: false },
};

/**
 * Where the QR code on a management or staff card leads. A steward scans it
 * and sees, from the federation's own record today, whether the card is
 * valid. Players, coaches and officials have live profiles that do this job.
 */
export default async function VerifyCard({ params }: { params: { kind: string; id: string } }) {
  if (!["management", "staff"].includes(params.kind)) notFound();
  const d = await getIdCardData(params.kind as CardKind, params.id);
  if (!d) notFound();

  const state = d.revoked ? "revoked" : d.expired ? "expired" : "valid";
  const banner = {
    valid: { text: "Valid", sub: `Until ${d.validUntil}`, cls: "bg-emerald-600" },
    expired: { text: "Expired", sub: `Ended ${d.validUntil}`, cls: "bg-amber-600" },
    revoked: { text: "Not valid", sub: "This card has been withdrawn by the federation", cls: "bg-red-700" },
  }[state];

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 bg-neutral-900">
        <div className={`${banner.cls} px-5 py-4`}>
          <p className="text-[11px] uppercase tracking-widest text-white/80">RLFG card check</p>
          <p className="font-display text-3xl">{banner.text}</p>
          <p className="text-sm text-white/90">{banner.sub}</p>
        </div>
        <div className="p-5 flex gap-4 items-center">
          {d.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.photo} alt="" className="w-20 h-24 rounded-lg object-cover object-top border border-white/10" />
          ) : (
            <div className="w-20 h-24 rounded-lg bg-white/10 grid place-items-center font-display text-2xl text-white/40">
              {(d.firstName[0] ?? "") + (d.lastName[0] ?? "")}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-xl leading-tight break-words">{d.name}</p>
            <p className="text-sm text-slate-300">{d.fields[0]?.value}</p>
            <p className="text-sm text-slate-400">{d.org}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">{d.cardNumber}</p>
          </div>
        </div>
        <p className="px-5 pb-5 text-xs text-slate-500">
          {d.theme.title.charAt(0) + d.theme.title.slice(1).toLowerCase()} · Rugby League Federation Ghana. Checked against
          the federation&rsquo;s record just now.
        </p>
      </div>
    </main>
  );
}
