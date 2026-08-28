import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import { ListHeader } from "@/components/admin/ListHeader";
import { DeleteRowButton } from "@/components/admin/DeleteRowButton";
import { deletePartner } from "./actions";

export default async function PartnersPage() {
  const supabase = createAdminClient();

  const { data: partners, error } = await supabase
    .from("partners")
    .select("partner_id, name, link, logo_url, designation, tier, tier_title, sort_order, status")
    .order("tier")
    .order("sort_order");

  // Grouped the way the website renders them, so the ordering you see here is
  // the ordering visitors see.
  const tiers = [1, 2, 3].map((tier) => ({
    tier,
    title:
      (partners ?? []).find((p: any) => p.tier === tier && p.tier_title)?.tier_title ??
      `Tier ${tier}`,
    rows: (partners ?? []).filter((p: any) => p.tier === tier),
  }));

  return (
    <div className="p-4 md:p-8">
      <ListHeader title="Partners" addHref="/admin/partners/new" addLabel="Add Partner" />
      <p className="text-sm text-slate-500 mb-4 -mt-2">
        Sponsor logos on the public partners page and in the site footer.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 text-sm px-3 py-2 rounded mb-4">
          {error.message}
        </div>
      )}

      <div className="space-y-6">
        {tiers.map((t) => (
          <div key={t.tier}>
            <h2 className="font-display text-lg text-navy-900 mb-2">
              {t.title}{" "}
              <span className="text-slate-400 text-sm font-sans">
                ({t.rows.length})
              </span>
            </h2>
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-700 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Partner</th>
                    <th className="hidden md:table-cell px-4 py-2.5 font-medium">Designation</th>
                    <th className="hidden lg:table-cell px-4 py-2.5 font-medium">Link</th>
                    <th className="px-4 py-2.5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {t.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                        Nothing in this tier.
                      </td>
                    </tr>
                  ) : (
                    t.rows.map((p: any) => (
                      <tr key={p.partner_id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-medium text-navy-900">
                          <span className="flex items-center gap-2">
                            {p.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.logo_url} alt="" referrerPolicy="no-referrer" className="w-8 h-8 object-contain bg-slate-50 rounded" />
                            ) : (
                              <span className="w-8 h-8 rounded bg-slate-100" />
                            )}
                            {p.name}
                            {p.status !== "active" && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {p.status}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="hidden md:table-cell px-4 py-2.5 text-slate-600">{p.designation ?? "\u2014"}</td>
                        <td className="hidden lg:table-cell px-4 py-2.5">
                          {p.link ? (
                            <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-navy-700 hover:underline">
                              Visit
                            </a>
                          ) : (
                            <span className="text-slate-400">&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                          <Link href={`/admin/partners/${p.partner_id}`} className="text-navy-700 hover:underline text-sm">Edit</Link>
                          <DeleteRowButton id={p.partner_id} action={deletePartner} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
