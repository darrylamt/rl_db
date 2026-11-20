import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    // Handle CORS preflight for /api/* routes so browsers can call the API
    // from any origin (including the public rugby league website).
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }
    // Public reads need no session. Checking one meant a round trip to
    // Supabase's auth on every request rlghana.com made, which cost hosting
    // time and filled the database's logs. Writes and the admin routes still
    // refresh the session, so a signed-in user's token stays valid.
    if ((request.method === "GET" || request.method === "HEAD") && !pathname.startsWith("/api/admin/")) {
      return NextResponse.next();
    }
  }

  return updateSession(request);
}

export const config = {
  // Only where a sign-in matters: the admin, club, recorder and player
  // portals, choosing a password, the print pages, and the API (see above). The public /live
  // pages, the verify page and static files never run this at all.
  matcher: [
    "/admin/:path*",
    "/club/:path*",
    "/enter/:path*",
    "/player/:path*",
    "/account/:path*",
    "/print/:path*",
    "/api/:path*",
  ],
};
