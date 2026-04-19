import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api — index listing available endpoints.
export async function GET() {
  return ok({
    name: "GRLF Public API",
    version: "1.0",
    endpoints: {
      "GET /api/teams": "List all teams",
      "POST /api/teams": "Create team (admin only)",
      "GET /api/players": "List players. ?team=<uuid> to filter",
      "POST /api/players": "Create player (admin only)",
      "GET /api/officials": "List officials",
      "POST /api/officials": "Create official (admin only)",
      "GET /api/venues": "List venues",
      "POST /api/venues": "Create venue (admin only)",
      "GET /api/competitions": "List competitions",
      "POST /api/competitions": "Create competition (admin only)",
      "GET /api/fixtures":
        "List fixtures. ?competition=, ?team=, ?status= to filter",
      "POST /api/fixtures": "Create fixture (admin only)",
      "GET /api/results": "List match results (non-0-0 only). ?competition=, ?team= to filter",
      "POST /api/results": "Upsert match result + mark fixture completed (admin only)",
      "GET /api/events": "Match events. ?fixture= or ?player= required",
      "POST /api/events": "Create match event (admin only)",
      "GET /api/standings": "League standings view. ?competition= to filter",
    },
    auth: "Admin POST requires a valid Supabase session cookie (sign in at /admin/login)",
  });
}
