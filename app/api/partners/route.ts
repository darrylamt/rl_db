import { createPublicClient, createAdminClient } from "@/lib/supabase/server";
import { ok, fail, preflight, requireAdmin, readJson } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return preflight();
}

type PartnerRow = {
  partner_id: string;
  name: string;
  link: string | null;
  logo_url: string | null;
  designation: string | null;
  tier: number;
  tier_title: string | null;
  sort_order: number;
};

const TIER_KEYS = ["tier_one", "tier_two", "tier_three"] as const;
const TIER_FALLBACK_TITLES = ["Official Partners", "Partners", "Suppliers"];

// GET /api/partners        → grouped into tier_one / tier_two / tier_three
// GET /api/partners?flat=1 → a plain list, for the footer
//
// Grouping happens here rather than in the website so the footer and the
// partners page can't drift apart.
export async function GET(req: Request) {
  const supabase = createPublicClient();
  const url = new URL(req.url);
  const flat = url.searchParams.get("flat");

  const { data, error } = await supabase
    .from("partners")
    .select(
      "partner_id, name, link, logo_url, designation, tier, tier_title, sort_order"
    )
    .eq("status", "active")
    .order("tier", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) return fail(error.message, 500);
  const items = (data ?? []) as PartnerRow[];

  if (flat) return ok({ items, total: items.length });

  const grouped: Record<string, { tier_title: string; list: PartnerRow[] }> = {};
  TIER_KEYS.forEach((key, i) => {
    const tierNo = i + 1;
    const list = items.filter((p) => p.tier === tierNo);
    grouped[key] = {
      // Title is editable copy stored per row; take the first one set.
      tier_title:
        list.find((p) => p.tier_title)?.tier_title ?? TIER_FALLBACK_TITLES[i],
      list,
    };
  });

  return ok(grouped);
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.response) return auth.response;

  const body = await readJson(req);
  if (!body) return fail("Invalid JSON body");
  if (!body.name) return fail("`name` is required");

  const tier = Number(body.tier ?? 1);
  if (!Number.isInteger(tier) || tier < 1 || tier > 3) {
    return fail("`tier` must be 1, 2 or 3");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partners")
    .insert({
      name: body.name,
      link: body.link ?? null,
      logo_url: body.logo_url ?? null,
      designation: body.designation ?? null,
      tier,
      tier_title: body.tier_title ?? null,
      sort_order: body.sort_order ?? 0,
      status: body.status ?? "active",
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
