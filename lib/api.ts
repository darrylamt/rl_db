import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ----------------------------------------------------------------------
// Shared helpers for /api/* routes.
// ----------------------------------------------------------------------

// CORS headers applied to every public GET response so that the external
// rugby league website (any origin) can call the API from the browser.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Public list routes are cached for 60 s at the CDN / browser; stale
// responses are served for up to 30 s more while a revalidation happens.
const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=30";

// Shorter TTL for data that changes often (live match events, results).
const SHORT_CACHE = "public, s-maxage=10, stale-while-revalidate=5";

export function ok<T>(
  data: T,
  init?: ResponseInit & { cache?: "public" | "short" | "none" }
) {
  const { cache = "public", ...rest } = init ?? {};
  const cacheHeader =
    cache === "none" ? "no-store" : cache === "short" ? SHORT_CACHE : PUBLIC_CACHE;

  return NextResponse.json(
    { ok: true, data },
    {
      ...rest,
      headers: {
        ...CORS_HEADERS,
        "Cache-Control": cacheHeader,
        ...(rest as any)?.headers,
      },
    }
  );
}

export function fail(message: string, status = 400) {
  return NextResponse.json(
    { ok: false, error: message },
    { status, headers: CORS_HEADERS }
  );
}

// Handles CORS preflight requests — call this from an OPTIONS export.
export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
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

// Safe JSON body read.
export async function readJson<T = any>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

// Parse `?limit=` and `?offset=` with sane defaults.
export function parsePagination(
  url: URL,
  defaults: { limit?: number; maxLimit?: number } = {}
) {
  const { limit: defaultLimit = 50, maxLimit = 200 } = defaults;
  const limit = Math.min(
    Math.max(1, parseInt(url.searchParams.get("limit") ?? String(defaultLimit), 10) || defaultLimit),
    maxLimit
  );
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  return { limit, offset, from: offset, to: offset + limit - 1 };
}
