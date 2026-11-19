import Link from "next/link";
import { getSignatory } from "@/lib/signature";
import { SignatureForm } from "./SignatureForm";

export const dynamic = "force-dynamic";

/** The General Manager's signature, printed on every ID card and transfer sheet. */
export default async function SignaturePage() {
  const s = await getSignatory();
  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <Link href="/admin/id-cards" className="text-sm text-navy-700 hover:underline">
        ← ID Cards
      </Link>
      <h1 className="font-display text-3xl font-bold text-navy-900 mt-2">Signature</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6 max-w-2xl">
        The General Manager&rsquo;s signature appears on the back of every ID card and in the federation&rsquo;s box on transfer
        sheets. Replace it here when it changes; cards printed afterwards use the new one.
      </p>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6">
        <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Current</p>
        {s ? (
          <div className="inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.url} alt="Current signature" className="h-20 w-auto" />
            <div className="border-t border-navy-900 mt-1 pt-1 text-sm text-navy-900 min-w-[16rem]">
              {s.name}, <span className="text-slate-500">{s.title}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">None yet. Cards show an empty signature line until one is added.</p>
        )}
      </div>

      <SignatureForm name={s?.name ?? "Jafaru Awudu Mustapha"} title={s?.title ?? "General Manager"} />
    </div>
  );
}
