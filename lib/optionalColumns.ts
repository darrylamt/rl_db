// ----------------------------------------------------------------------
// Tolerating columns that may not exist yet.
//
// Schema migrations here are applied by hand in the Supabase SQL editor,
// which means a deploy can land before its migration does. Writing to a
// column that isn't there yet fails the whole save, so admin forms would
// break for anyone who hasn't run the SQL.
//
// These helpers let a write carry its new fields optimistically and retry
// without them if the database hasn't caught up.
// ----------------------------------------------------------------------

/** True when an error is "that column isn't in the schema". */
export function isMissingColumnError(error: any): boolean {
  if (!error) return false;
  // 42703 = undefined_column (Postgres); PGRST204 = unknown column (PostgREST)
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const message = String(error.message ?? "");
  return (
    /could not find the .* column/i.test(message) ||
    (/column/i.test(message) && /does not exist/i.test(message))
  );
}

export function omit<T extends Record<string, any>>(
  obj: T,
  keys: readonly string[]
): Partial<T> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!keys.includes(k)) out[k] = v;
  }
  return out as Partial<T>;
}

/**
 * The same idea for reads: ask for the full column list, and ask again
 * without the ones the database has not caught up with yet.
 *
 * Selecting a column that isn't there fails the whole query, so without this
 * a page reading a new column is blank until the SQL is run.
 */
export async function readWithOptionalColumns<T>(
  columns: string,
  optional: readonly string[],
  run: (columns: string) => PromiseLike<{ data: T; error: any }>
): Promise<{ data: T; error: any }> {
  const first = await run(columns);
  if (!first.error || !isMissingColumnError(first.error)) return first;

  const reduced = columns
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c && !optional.includes(c))
    .join(", ");
  return run(reduced);
}

/**
 * Run a write with the full payload; if the database rejects it because one of
 * `optional` isn't there yet, run it again without them.
 *
 * Returns the error from the retry (or null), so a genuine failure still
 * surfaces normally.
 */
export async function writeWithOptionalColumns<T extends Record<string, any>>(
  payload: T,
  optional: readonly string[],
  run: (values: Record<string, any>) => PromiseLike<{ error: any }>
): Promise<{ error: any; droppedOptional: boolean }> {
  const { error } = await run(payload);
  if (!error || !isMissingColumnError(error)) {
    return { error, droppedOptional: false };
  }
  const { error: retryError } = await run(omit(payload, optional));
  return { error: retryError, droppedOptional: true };
}
