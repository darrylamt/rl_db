import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ----------------------------------------------------------------------
// Shared helpers for /api/* routes.
//   - `ok`      : typed JSON success response
//   - `fail`    : typed JSON error response
//   - `requireAdmin` : read the Supabase session cookie from the request
//                     and reject if the user is not signed in. Any signed-in
//                     user is treated as an admin (admin access is gated by
//                     middleware redirecting unauthenticated users away from
//                     the /admin tree).
// ----------------------------------------------------------------------

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null as null, response: fail("Unauthorized", 401) };
  }
  return { user, response: null as null };
}

// Small helper: safe JSON body read.
export async function readJson<T = any>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
