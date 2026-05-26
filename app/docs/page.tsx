import Link from "next/link";
import { PrintButton } from "@/components/PrintButton";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}


interface Endpoint {
  method: "GET" | "POST";
  path: string;
  description: string;
  params?: Param[];
  response: string; // JSON-like example as a string
  cacheNote?: string;
}

// ─── Content ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rl-db.vercel.app";

const ENDPOINTS: { section: string; description: string; endpoints: Endpoint[] }[] = [
  {
    section: "Competitions",
    description: "Rugby league competitions (leagues, cups, tournaments).",
    endpoints: [
      {
        method: "GET",
        path: "/api/competitions",
        description: "List all competitions. Optionally filter by season or status.",
        params: [
          { name: "season", type: "string", description: 'Season year, e.g. "2025"' },
          { name: "status", type: "string", description: '"active" | "upcoming" | "completed"' },
          { name: "limit", type: "number", description: "Items per page (default 50, max 200)" },
          { name: "offset", type: "number", description: "Pagination offset (default 0)" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "competition_id": "uuid",
        "name": "Premier League 2025",
        "season": "2025",
        "type": "league",
        "status": "active",
        "start_date": "2025-03-01",
        "end_date": "2025-11-30"
      }
    ],
    "total": 4
  }
}`,
        cacheNote: "Cached 60 s",
      },
    ],
  },
  {
    section: "Teams",
    description: "Clubs, national sides, and representative teams.",
    endpoints: [
      {
        method: "GET",
        path: "/api/teams",
        description: "List all teams. Filter by team type.",
        params: [
          { name: "type", type: "string", description: '"club" | "national" | "president_xv"' },
          { name: "limit", type: "number", description: "Items per page (default 50)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "team_id": "uuid",
        "name": "Accra Lions",
        "team_type": "club",
        "logo_url": "https://...",
        "founded_year": 2018,
        "home_venue": "Accra Stadium"
      }
    ],
    "total": 12
  }
}`,
        cacheNote: "Cached 60 s",
      },
      {
        method: "GET",
        path: "/api/teams/:id",
        description: "Full team profile — includes active squad and last 10 fixtures.",
        response: `{
  "ok": true,
  "data": {
    "team_id": "uuid",
    "name": "Accra Lions",
    "team_type": "club",
    "logo_url": "https://...",
    "players": [
      { "player_id": "uuid", "first_name": "Kwame", "last_name": "Mensah",
        "jersey_number": 9, "position": "Half Back", "playing_status": "active" }
    ],
    "recent_fixtures": [
      { "fixture_id": "uuid", "scheduled_date": "2025-05-10",
        "home": { "name": "Accra Lions" }, "away": { "name": "Kumasi Bulls" },
        "status": "completed",
        "result": { "home_score": 26, "away_score": 14 } }
    ]
  }
}`,
        cacheNote: "Cached 60 s",
      },
    ],
  },
  {
    section: "Players",
    description: "Player profiles and career statistics.",
    endpoints: [
      {
        method: "GET",
        path: "/api/players",
        description: "List players. Filter by team or playing status.",
        params: [
          { name: "team", type: "uuid", description: "Filter by team_id" },
          { name: "status", type: "string", description: '"active" | "injured" | "retired"' },
          { name: "limit", type: "number", description: "Items per page (default 50)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "player_id": "uuid",
        "first_name": "Kwame",
        "last_name": "Mensah",
        "jersey_number": 9,
        "position": "Half Back",
        "playing_status": "active",
        "rating": 7.2,
        "team": { "team_id": "uuid", "name": "Accra Lions" }
      }
    ],
    "total": 87
  }
}`,
        cacheNote: "Cached 60 s",
      },
      {
        method: "GET",
        path: "/api/players/:id",
        description: "Player profile with aggregated career stats from all match events.",
        response: `{
  "ok": true,
  "data": {
    "player_id": "uuid",
    "first_name": "Kwame",
    "last_name": "Mensah",
    "position": "Half Back",
    "jersey_number": 9,
    "date_of_birth": "1998-06-14",
    "nationality": "Ghanaian",
    "playing_status": "active",
    "rating": 7.2,
    "team": { "team_id": "uuid", "name": "Accra Lions" },
    "stats": {
      "matches_played": 24,
      "tries": 8,
      "conversions": 3,
      "penalty_goals": 1,
      "drop_goals": 0,
      "total_points": 41,
      "clean_breaks": 12,
      "tackle_breaks": 19,
      "offloads": 7,
      "tackles": 68,
      "missed_tackles": 5,
      "turnovers_won": 3,
      "yellow_cards": 1,
      "red_cards": 0
    }
  }
}`,
        cacheNote: "Cached 60 s",
      },
    ],
  },
  {
    section: "Fixtures",
    description: "Scheduled matches, including upcoming, live, and completed.",
    endpoints: [
      {
        method: "GET",
        path: "/api/fixtures",
        description: "List fixtures. Filter by competition, team, status, or season.",
        params: [
          { name: "competition", type: "uuid", description: "Filter by competition_id" },
          { name: "team", type: "uuid", description: "Filter by home or away team_id" },
          { name: "status", type: "string", description: '"scheduled" | "live" | "completed"' },
          { name: "season", type: "string", description: 'Season year, e.g. "2025"' },
          { name: "limit", type: "number", description: "Items per page (default 50)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "fixture_id": "uuid",
        "scheduled_date": "2025-06-07",
        "scheduled_time": "15:00:00",
        "round": "Round 8",
        "status": "scheduled",
        "home": { "team_id": "uuid", "name": "Accra Lions" },
        "away": { "team_id": "uuid", "name": "Kumasi Bulls" },
        "venue": { "name": "Accra Stadium" },
        "competition": { "name": "Premier League 2025", "season": "2025" }
      }
    ],
    "total": 32
  }
}`,
        cacheNote: "Cached 60 s",
      },
      {
        method: "GET",
        path: "/api/fixtures/:id",
        description: "Full fixture detail — includes result, all events (timeline), lineup, and match officials.",
        response: `{
  "ok": true,
  "data": {
    "fixture_id": "uuid",
    "scheduled_date": "2025-05-10",
    "status": "completed",
    "home": { "team_id": "uuid", "name": "Accra Lions" },
    "away": { "team_id": "uuid", "name": "Kumasi Bulls" },
    "competition": { "name": "Premier League 2025" },
    "result": {
      "home_score": 26,
      "away_score": 14,
      "home_tries": 5, "home_conversions": 3,
      "away_tries": 2, "away_conversions": 2
    },
    "events": [
      { "event_id": "uuid", "event_type": "try", "minute": 8, "half": 1,
        "player": { "first_name": "Kwame", "last_name": "Mensah" },
        "team": { "name": "Accra Lions" } }
    ],
    "lineup": [
      { "jersey_number": 1, "position": "Prop", "is_starter": true,
        "player": { "first_name": "Kofi", "last_name": "Adu" },
        "team": { "name": "Accra Lions" } }
    ]
  }
}`,
        cacheNote: "Cached 10 s (live data)",
      },
    ],
  },
  {
    section: "Results",
    description: "Completed match scorelines and breakdowns.",
    endpoints: [
      {
        method: "GET",
        path: "/api/results",
        description: "List results. Filter by competition, team, or season.",
        params: [
          { name: "competition", type: "uuid", description: "Filter by competition_id" },
          { name: "team", type: "uuid", description: "Filter by home or away team_id" },
          { name: "season", type: "string", description: 'Season year' },
          { name: "limit", type: "number", description: "Items per page (default 50)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "result_id": "uuid",
        "home_score": 26,
        "away_score": 14,
        "home_tries": 5, "home_conversions": 3,
        "home_penalties": 0, "home_drop_goals": 0,
        "away_tries": 2, "away_conversions": 2,
        "attendance": 1200,
        "fixture": {
          "fixture_id": "uuid",
          "scheduled_date": "2025-05-10",
          "home": { "name": "Accra Lions" },
          "away": { "name": "Kumasi Bulls" },
          "competition": { "name": "Premier League 2025" }
        }
      }
    ],
    "total": 18
  }
}`,
        cacheNote: "Cached 10 s",
      },
    ],
  },
  {
    section: "Standings",
    description: "League table — wins, losses, points for/against, and league points.",
    endpoints: [
      {
        method: "GET",
        path: "/api/standings",
        description: "League table rows. Filter by competition or season.",
        params: [
          { name: "competition", type: "uuid", description: "Filter by competition_id" },
          { name: "season", type: "string", description: 'Season year, e.g. "2025"' },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "team_id": "uuid",
        "team_name": "Accra Lions",
        "logo_url": "https://...",
        "competition_id": "uuid",
        "competition_name": "Premier League 2025",
        "played": 10,
        "won": 7,
        "drawn": 1,
        "lost": 2,
        "points_for": 198,
        "points_against": 112,
        "goal_difference": 86,
        "league_points": 15
      }
    ],
    "total": 8
  }
}`,
        cacheNote: "Cached 60 s",
      },
    ],
  },
  {
    section: "Match Events",
    description: "Individual in-game events — tries, conversions, cards, tackles, line breaks, and more.",
    endpoints: [
      {
        method: "GET",
        path: "/api/events",
        description: "Query events. Must provide at least one of: fixture, player, or team.",
        params: [
          { name: "fixture", type: "uuid", required: true, description: "Filter by fixture_id (required OR player OR team)" },
          { name: "player", type: "uuid", description: "Filter by player_id" },
          { name: "team", type: "uuid", description: "Filter by team_id" },
          { name: "type", type: "string", description: '"try" | "conversion" | "penalty_goal" | "drop_goal" | "yellow_card" | "red_card" | "tackle" | "tackle_break" | "clean_break" | "offload" | "turnover_won" | "missed_tackle" | "metres_gained" | "completed_set" | "missed_conversion"' },
          { name: "limit", type: "number", description: "Items per page (default 100)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "event_id": "uuid",
        "event_type": "try",
        "minute": 8,
        "half": 1,
        "notes": null,
        "player": { "player_id": "uuid", "first_name": "Kwame", "last_name": "Mensah" },
        "team": { "team_id": "uuid", "name": "Accra Lions" },
        "fixture_id": "uuid"
      }
    ],
    "total": 34
  }
}`,
        cacheNote: "Cached 10 s",
      },
    ],
  },
  {
    section: "Officials",
    description: "Referees, touch judges, and other match officials.",
    endpoints: [
      {
        method: "GET",
        path: "/api/officials",
        description: "List officials. Filter by status.",
        params: [
          { name: "status", type: "string", description: '"active" | "inactive"' },
          { name: "limit", type: "number", description: "Items per page (default 50)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "official_id": "uuid",
        "first_name": "Ama",
        "last_name": "Owusu",
        "role": "referee",
        "status": "active"
      }
    ],
    "total": 6
  }
}`,
        cacheNote: "Cached 60 s",
      },
    ],
  },
  {
    section: "Venues",
    description: "Stadiums and training grounds.",
    endpoints: [
      {
        method: "GET",
        path: "/api/venues",
        description: "List all venues.",
        params: [
          { name: "limit", type: "number", description: "Items per page (default 50)" },
          { name: "offset", type: "number", description: "Pagination offset" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "venue_id": "uuid",
        "name": "Accra Stadium",
        "city": "Accra",
        "capacity": 5000,
        "surface": "grass"
      }
    ],
    "total": 3
  }
}`,
        cacheNote: "Cached 60 s",
      },
    ],
  },
  {
    section: "Articles",
    description: "News articles and match reports published by the federation.",
    endpoints: [
      {
        method: "GET",
        path: "/api/articles",
        description: "List published articles, newest first. Filter by tag and paginate.",
        params: [
          { name: "tag", type: "string", description: 'Filter by a single tag, e.g. "match report" or "announcement"' },
          { name: "limit", type: "number", description: "Items per page (default 50, max 200)" },
          { name: "offset", type: "number", description: "Pagination offset (default 0)" },
        ],
        response: `{
  "ok": true,
  "data": {
    "items": [
      {
        "article_id": "uuid",
        "title": "Lions Beat Bulls 26–14 in Thriller",
        "slug": "lions-beat-bulls-26-14-in-thriller",
        "excerpt": "Accra Lions secured a commanding home win…",
        "cover_image_url": "https://….supabase.co/storage/v1/object/public/article-images/…",
        "author": "RLFG Media",
        "tags": ["match report", "premier league"],
        "status": "published",
        "published_at": "2025-06-07T15:30:00Z",
        "updated_at": "2025-06-07T16:00:00Z"
      }
    ],
    "total": 24
  }
}`,
        cacheNote: "Cached 10 s",
      },
      {
        method: "GET",
        path: "/api/articles/:slug",
        description: "Full article by URL slug — includes the HTML body content for rendering on your site.",
        response: `{
  "ok": true,
  "data": {
    "article_id": "uuid",
    "title": "Lions Beat Bulls 26–14 in Thriller",
    "slug": "lions-beat-bulls-26-14-in-thriller",
    "excerpt": "Accra Lions secured a commanding home win…",
    "content": "<h2>First Half</h2><p>The Lions started brightly…</p>",
    "cover_image_url": "https://….supabase.co/storage/v1/object/public/article-images/…",
    "author": "RLFG Media",
    "tags": ["match report", "premier league"],
    "published_at": "2025-06-07T15:30:00Z",
    "updated_at": "2025-06-07T16:00:00Z"
  }
}`,
        cacheNote: "Cached 10 s",
      },
    ],
  },
];

// ─── UI helpers ───────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded font-mono ${
      method === "GET"
        ? "bg-emerald-100 text-emerald-800"
        : "bg-amber-100 text-amber-800"
    }`}>
      {method}
    </span>
  );
}

function EndpointCard({ ep }: { ep: Endpoint }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <MethodBadge method={ep.method} />
        <code className="text-sm font-mono font-semibold text-navy-900 break-all">{ep.path}</code>
        {ep.cacheNote && (
          <span className="ml-auto text-xs text-slate-400 shrink-0">{ep.cacheNote}</span>
        )}
      </div>

      <div className="px-4 py-3 space-y-4">
        <p className="text-sm text-slate-600">{ep.description}</p>

        {ep.params && ep.params.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Query Parameters</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[400px]">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-2 py-1.5 font-medium text-slate-600 w-32">Name</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600 w-20">Type</th>
                    <th className="px-2 py-1.5 font-medium text-slate-600">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ep.params.map((p) => (
                    <tr key={p.name}>
                      <td className="px-2 py-1.5">
                        <code className="text-navy-800">{p.name}</code>
                        {p.required && <span className="ml-1 text-red-500">*</span>}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500">{p.type}</td>
                      <td className="px-2 py-1.5 text-slate-500 break-words">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Example Response</p>
          <pre className="bg-slate-900 text-emerald-300 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {ep.response}
          </pre>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const sections = ENDPOINTS.map((s) => s.section);

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Print styles — injected as a style tag so no extra CSS file needed */}
      <style>{`
        @media print {
          @page { margin: 1.5cm 2cm; }
          .print-hide { display: none !important; }
          pre { white-space: pre-wrap; word-break: break-word; }
          h1, h2 { page-break-after: avoid; }
          pre, table { page-break-inside: avoid; }
        }
      `}</style>

      {/* Top nav */}
      <header className="print-hide sticky top-0 z-10 bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="font-display font-bold text-navy-900 text-lg whitespace-nowrap">RLFG</Link>
          <span className="text-slate-300">|</span>
          <span className="text-sm font-medium text-slate-600">API Documentation</span>
          <span className="hidden sm:inline-block text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">v1.0</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PrintButton className="inline-flex items-center gap-1.5 text-xs bg-navy-900 text-white px-3 py-1.5 rounded hover:bg-navy-700 transition-colors font-medium" />
          <a
            href={`${BASE_URL}/api`}
            target="_blank"
            rel="noopener"
            className="text-xs text-navy-700 hover:underline whitespace-nowrap hidden sm:block"
          >
            /api index ↗
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">

          {/* Sidebar TOC (desktop) */}
          <aside className="print-hide hidden md:block w-48 shrink-0">
            <div className="sticky top-20 space-y-1">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Sections</p>
              <a href="#overview" className="block text-sm text-slate-600 hover:text-navy-700 py-0.5">Overview</a>
              {sections.map((s) => (
                <a
                  key={s}
                  href={`#${s.toLowerCase()}`}
                  className="block text-sm text-slate-600 hover:text-navy-700 py-0.5"
                >
                  {s}
                </a>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Overview */}
            <section id="overview">
              <h1 className="font-display text-3xl font-bold text-navy-900 mb-2">RLFG Public API</h1>
              <p className="text-slate-600 mb-6">
                Open REST API for the Rugby League Federation of Ghana. All endpoints are read-only (GET) and publicly accessible — no authentication required. Article images are served directly from Supabase Storage CDN.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1 font-semibold">Base URL</p>
                  <code className="text-sm font-mono text-navy-900 break-all">{BASE_URL}/api</code>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1 font-semibold">CORS</p>
                  <p className="text-sm text-slate-600">All origins allowed — use from any domain or mobile app.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1 font-semibold">Response format</p>
                  <p className="text-sm text-slate-600">All responses are JSON wrapped in <code className="text-xs bg-slate-100 px-1 rounded">{"{ ok, data }"}</code> or <code className="text-xs bg-slate-100 px-1 rounded">{"{ ok, error }"}</code></p>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500 mb-1 font-semibold">Caching</p>
                  <p className="text-sm text-slate-600">Static lists cached 60 s. Live data (results, events) cached 10 s.</p>
                </div>
              </div>

              {/* Pagination */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Pagination</p>
                <p className="text-sm text-slate-600 mb-2">All list endpoints accept <code className="text-xs bg-slate-100 px-1 rounded">?limit=</code> (max 200, default 50) and <code className="text-xs bg-slate-100 px-1 rounded">?offset=</code> (default 0). The response includes a <code className="text-xs bg-slate-100 px-1 rounded">total</code> count for building pagination UI.</p>
                <pre className="bg-slate-900 text-emerald-300 text-xs rounded p-3 overflow-x-auto">{`GET /api/players?limit=20&offset=40
// Returns players 41–60 and total count`}</pre>
              </div>

              {/* Error format */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Error Responses</p>
                <pre className="bg-slate-900 text-red-300 text-xs rounded p-3 overflow-x-auto">{`// 400 Bad Request
{ "ok": false, "error": "fixture param is required" }

// 404 Not Found
{ "ok": false, "error": "not found" }

// 500 Internal Server Error
{ "ok": false, "error": "internal error" }`}</pre>
              </div>
            </section>

            {/* Endpoint sections */}
            {ENDPOINTS.map((section) => (
              <section key={section.section} id={section.section.toLowerCase()}>
                <h2 className="font-display text-xl font-bold text-navy-900 mb-1">{section.section}</h2>
                <p className="text-sm text-slate-500 mb-4">{section.description}</p>
                {section.endpoints.map((ep) => (
                  <EndpointCard key={ep.path} ep={ep} />
                ))}
              </section>
            ))}

            {/* Footer */}
            <div className="border-t border-slate-200 pt-6 text-xs text-slate-400 space-y-1">
              <p>Rugby League Federation of Ghana · Public API v1.0</p>
              <p>Questions or issues? Contact the federation.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
