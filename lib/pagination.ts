// Parse ?page= from Next searchParams and compute Supabase .range() bounds.
//
// Usage:
//   const { page, pageSize, from, to } = getPageParams(searchParams);
//   const { data, count } = await supabase.from("x")
//     .select("*", { count: "exact" })
//     .range(from, to);

export type PageParams = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

export function getPageParams(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  pageSize = 20
): PageParams {
  const raw = searchParams?.page;
  const str = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(str ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { page, pageSize, from, to };
}
