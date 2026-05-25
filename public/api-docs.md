# RLFG Public API — Documentation

**Version:** 1.0  
**Base URL:** `https://your-domain.com/api`  
**CORS:** All origins allowed — use from any domain or mobile app.

---

## Overview

Open REST API for the Rugby League Federation of Ghana. All **GET** endpoints are publicly accessible — no authentication required. **POST** endpoints require an admin session cookie (sign in at `/admin/login`).

### Response Format

All responses are JSON wrapped in a consistent envelope:

```json
// Success
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": "description of what went wrong" }
```

### Pagination

All list endpoints accept `?limit=` (max 200, default 50) and `?offset=` (default 0).  
The response `data` object includes a `total` field for building pagination UI.

```
GET /api/players?limit=20&offset=40
→ Returns players 41–60, total: N
```

### Caching

| Route type | Cache TTL |
|---|---|
| Static lists (teams, players, competitions, standings, venues, officials) | 60 seconds |
| Live data (results, events, fixture detail) | 10 seconds |

### Error Codes

| HTTP | Meaning |
|---|---|
| 400 | Bad request — missing or invalid parameters |
| 404 | Resource not found |
| 500 | Internal server error |

---

## Competitions

### `GET /api/competitions`

List all competitions (leagues, cups, tournaments).

**Query Parameters**

| Name | Type | Description |
|---|---|---|
| `season` | string | Filter by season year, e.g. `2025` |
| `status` | string | `active` \| `upcoming` \| `completed` |
| `limit` | number | Items per page (default 50, max 200) |
| `offset` | number | Pagination offset (default 0) |

**Example Response**

```json
{
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
}
```

---

## Teams

### `GET /api/teams`

List all teams.

**Query Parameters**

| Name | Type | Description |
|---|---|---|
| `type` | string | `club` \| `national` \| `president_xv` |
| `limit` | number | Items per page (default 50) |
| `offset` | number | Pagination offset |

**Example Response**

```json
{
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
}
```

### `GET /api/teams/:id`

Full team profile — includes active squad and last 10 fixtures.

**Example Response**

```json
{
  "ok": true,
  "data": {
    "team_id": "uuid",
    "name": "Accra Lions",
    "team_type": "club",
    "logo_url": "https://...",
    "players": [
      {
        "player_id": "uuid",
        "first_name": "Kwame",
        "last_name": "Mensah",
        "jersey_number": 9,
        "position": "Half Back",
        "playing_status": "active"
      }
    ],
    "recent_fixtures": [
      {
        "fixture_id": "uuid",
        "scheduled_date": "2025-05-10",
        "home": { "name": "Accra Lions" },
        "away": { "name": "Kumasi Bulls" },
        "status": "completed",
        "result": { "home_score": 26, "away_score": 14 }
      }
    ]
  }
}
```

---

## Players

### `GET /api/players`

List players. Filter by team or playing status.

**Query Parameters**

| Name | Type | Description |
|---|---|---|
| `team` | uuid | Filter by `team_id` |
| `status` | string | `active` \| `injured` \| `retired` |
| `limit` | number | Items per page (default 50) |
| `offset` | number | Pagination offset |

**Example Response**

```json
{
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
}
```

### `GET /api/players/:id`

Player profile with aggregated career stats from all match events.

The `rating` field is the player's **general rating** — a rolling average of all their match ratings (default 6.0 for players with no ratings yet).

**Example Response**

```json
{
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
}
```

---

## Fixtures

### `GET /api/fixtures`

List fixtures. Filter by competition, team, status, or season.

**Query Parameters**

| Name | Type | Description |
|---|---|---|
| `competition` | uuid | Filter by `competition_id` |
| `team` | uuid | Filter by home or away `team_id` |
| `status` | string | `scheduled` \| `live` \| `completed` |
| `season` | string | Season year, e.g. `2025` |
| `limit` | number | Items per page (default 50) |
| `offset` | number | Pagination offset |

**Example Response**

```json
{
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
}
```

### `GET /api/fixtures/:id`

Full fixture detail — includes result, all events (match timeline), lineup, and officials.  
*Cached 10 seconds (live data).*

**Example Response**

```json
{
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
      "home_tries": 5,
      "home_conversions": 3,
      "away_tries": 2,
      "away_conversions": 2
    },
    "events": [
      {
        "event_id": "uuid",
        "event_type": "try",
        "minute": 8,
        "half": 1,
        "notes": null,
        "player": { "first_name": "Kwame", "last_name": "Mensah" },
        "team": { "name": "Accra Lions" }
      }
    ],
    "lineup": [
      {
        "jersey_number": 1,
        "position": "Prop",
        "is_starter": true,
        "player": { "first_name": "Kofi", "last_name": "Adu" },
        "team": { "name": "Accra Lions" }
      }
    ]
  }
}
```

---

## Results

### `GET /api/results`

Completed match scorelines and breakdowns.

**Query Parameters**

| Name | Type | Description |
|---|---|---|
| `competition` | uuid | Filter by `competition_id` |
| `team` | uuid | Filter by home or away `team_id` |
| `season` | string | Season year |
| `limit` | number | Items per page (default 50) |
| `offset` | number | Pagination offset |

**Example Response**

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "result_id": "uuid",
        "home_score": 26,
        "away_score": 14,
        "home_tries": 5,
        "home_conversions": 3,
        "home_penalties": 0,
        "home_drop_goals": 0,
        "away_tries": 2,
        "away_conversions": 2,
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
}
```

---

## Standings

### `GET /api/standings`

League table — wins, losses, points for/against, and league points.

**Query Parameters**

| Name | Type | Description |
|---|---|---|
| `competition` | uuid | Filter by `competition_id` |
| `season` | string | Season year, e.g. `2025` |

**Example Response**

```json
{
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
}
```

---

## Match Events

### `GET /api/events`

Individual in-game events — tries, conversions, cards, tackles, line breaks, and more.  
Must provide at least one of: `fixture`, `player`, or `team`.

**Query Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `fixture` | uuid | one of these required | Filter by `fixture_id` |
| `player` | uuid | one of these required | Filter by `player_id` |
| `team` | uuid | one of these required | Filter by `team_id` |
| `type` | string | | Event type — see list below |
| `limit` | number | | Items per page (default 100) |
| `offset` | number | | Pagination offset |

**Event Types**

`try`, `conversion`, `missed_conversion`, `penalty_goal`, `drop_goal`, `yellow_card`, `red_card`, `tackle`, `missed_tackle`, `tackle_break`, `clean_break`, `offload`, `turnover_won`, `metres_gained`, `completed_set`

**Example Response**

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "event_id": "uuid",
        "event_type": "try",
        "minute": 8,
        "half": 1,
        "notes": null,
        "player": {
          "player_id": "uuid",
          "first_name": "Kwame",
          "last_name": "Mensah"
        },
        "team": { "team_id": "uuid", "name": "Accra Lions" },
        "fixture_id": "uuid"
      }
    ],
    "total": 34
  }
}
```

---

## Officials

### `GET /api/officials`

Referees, touch judges, and other match officials.

**Query Parameters**

| Name | Type | Description |
|---|---|---|
| `status` | string | `active` \| `inactive` |
| `limit` | number | Items per page (default 50) |
| `offset` | number | Pagination offset |

**Example Response**

```json
{
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
}
```

---

## Venues

### `GET /api/venues`

Stadiums and training grounds.

**Query Parameters**

| Name | Type | Description |
|---|---|---|
| `limit` | number | Items per page (default 50) |
| `offset` | number | Pagination offset |

**Example Response**

```json
{
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
}
```

---

## Scoring Reference

Rugby League point values used throughout the API:

| Scoring action | Points |
|---|---|
| Try | 4 |
| Conversion | 2 |
| Penalty goal | 2 |
| Drop goal | 1 |

---

## Player Rating System

Player ratings are on a **1.0–10.0** scale (one decimal place).

| Range | Rating |
|---|---|
| 8.0–10.0 | Outstanding |
| 6.5–7.9 | Good |
| 5.0–6.4 | Average |
| 1.0–4.9 | Poor |

- **Match rating** — awarded per fixture, auto-calculated from in-game events using a weighted formula (base 6.0). Admins can override.
- **General rating** (the `rating` field on player objects) — rolling average of all match ratings. Defaults to 6.0 for players with no ratings recorded yet.

---

*Rugby League Federation of Ghana · Public API v1.0*
