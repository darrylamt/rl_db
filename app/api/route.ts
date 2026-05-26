import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api — index listing all available endpoints.
export async function GET() {
  return ok({
    name: "RLFG Public API",
    version: "1.0",
    description: "Public read API for the Rugby League Federation of Ghana. All GET endpoints are open. POST endpoints require an admin session.",
    docs: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://rl-db.vercel.app"}/docs`,
    notes: [
      "Responses are wrapped: { ok: true, data: ... } or { ok: false, error: '...' }",
      "List endpoints return { items: [...], total: N }",
      "Pagination: ?limit=50&offset=0 on all list endpoints (max 200)",
      "GET responses are cached: list routes 60 s, live data (results/events) 10 s",
      "CORS: all origins allowed for GET/POST/OPTIONS",
    ],
    endpoints: {
      "GET /api/competitions": "List competitions. ?season=2025 ?status=active|upcoming|completed",
      "GET /api/competitions/:id": "— (use standings or fixtures filtered by competition)",

      "GET /api/fixtures": "List fixtures. ?competition=<uuid> ?team=<uuid> ?status=scheduled|completed|live ?season=2025",
      "GET /api/fixtures/:id": "Single fixture — includes result, events, lineup, officials",

      "GET /api/results": "Match results. ?competition=<uuid> ?team=<uuid> ?season=2025",

      "GET /api/standings": "League table. ?competition=<uuid> ?season=2025",

      "GET /api/teams": "List teams. ?type=club|national|president_xv",
      "GET /api/teams/:id": "Team profile — includes active players + last 10 fixtures",

      "GET /api/players": "List players. ?team=<uuid> ?status=active|injured|retired",
      "GET /api/players/:id": "Player profile — includes career stats aggregated from events",

      "GET /api/events": "Match events. ?fixture=<uuid> OR ?player=<uuid> OR ?team=<uuid>. ?type=try|conversion|...",

      "GET /api/officials": "List officials. ?status=active|inactive",

      "GET /api/venues": "List venues.",

      "GET /api/articles": "Published articles / news. ?tag=<string> ?limit=10 ?offset=0",
      "GET /api/articles/:slug": "Full article content by slug (HTML body included)",
    },
    admin_endpoints: {
      note: "Require a valid Supabase session cookie (sign in at /admin/login)",
      routes: [
        "POST /api/fixtures",
        "POST /api/results",
        "POST /api/events",
        "POST /api/teams",
        "POST /api/players",
        "POST /api/officials",
        "POST /api/competitions",
        "POST /api/venues",
      ],
    },
  });
}
