import { unstable_cache } from "next/cache";
import { createAdminClient, createPublicClient } from "@/lib/supabase/server";

/**
 * Every row of a table, read through a five-minute server cache.
 *
 * The valuation and the record book are worked out from the whole match
 * record, and each read it in full on every visit: every player page, the
 * values page, every club's value, the record book. Half a megabyte each
 * time, leaving Supabase, whose free plan meters that. A crawler walking the
 * five hundred player pages pulled a quarter of a gigabyte on its own.
 *
 * Kept for five minutes in Next's data cache, shared across visits and
 * serverless instances, the record leaves the database at most once in that
 * time whoever is looking. A result entered now reaches the values and the
 * record book within five minutes. Match pages don't read through this, so a
 * live score is never held back.
 *
 * `client` keeps the two readers' permissions apart: the record book reads
 * what the public may see, the valuation reads with the service key (it
 * needs dates of birth, which it uses and never returns). They are cached
 * under different keys and never share rows.
 */
const TTL_SECONDS = 300;

/** Tag on every cached table, for anything that wants to drop them early. */
export const MATCH_RECORD_TAG = "match-record";

async function readAll<T>(
  client: "public" | "admin",
  table: string,
  columns: string
): Promise<T[]> {
  const supabase = client === "admin" ? createAdminClient() : createPublicClient();
  const out: T[] = [];
  // Paged, because PostgREST stops at 1000 without saying so.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + 999);
    // Thrown, so a failed read is never cached and served for five minutes.
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function wholeTable<T = any>(
  client: "public" | "admin",
  table: string,
  columns: string
): Promise<T[]> {
  const cached = unstable_cache(
    () => readAll<T>(client, table, columns),
    ["whole-table", client, table, columns],
    { revalidate: TTL_SECONDS, tags: [MATCH_RECORD_TAG, `table:${table}`] }
  );
  try {
    return await cached();
  } catch {
    // The cache unavailable (outside a request, say) or the read failed: try
    // once directly, so the worst case is the old behaviour, not blank pages.
    // A table that still can't be read counts as empty, as it always did.
    try {
      return await readAll<T>(client, table, columns);
    } catch {
      return [];
    }
  }
}
