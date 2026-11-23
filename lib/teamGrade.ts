/**
 * Which side of a club is playing.
 *
 * A club fields men, women, youth boys and youth girls from one team row, so
 * "Accra Panthers v Bulls" said nothing about which of them. In a fixture the
 * competition's division answers that, and the name carries it:
 *
 *   men          Accra Panthers
 *   women        Accra Panthers (W)
 *   youth girls  Accra Panthers (YG)
 *   youth boys   Accra Panthers (YB)
 */

const SUFFIX: Record<string, string> = {
  women: "W",
  senior_women: "W",
  youth_girls: "YG",
  youth_boys: "YB",
};

/** A team's name as it plays in a competition of this division. */
export function gradedName(name: string, division: string | null | undefined): string {
  const tag = SUFFIX[(division ?? "").toLowerCase().replace(/\s+/g, "_")];
  if (!tag || !name) return name;
  // Already says it: "Women National Team", or a name graded once already.
  if (/\((W|YG|YB)\)\s*$/.test(name) || /women|youth|girls|boys/i.test(name)) return name;
  return `${name} (${tag})`;
}

const SIDES = ["home", "away", "home_team", "away_team"];

function first(x: any) {
  return Array.isArray(x) ? x[0] : x;
}

/**
 * Grades the team names in every fixture inside a query result, in place.
 *
 * A fixture is any object with a competition that has a division and a home
 * or away team with a name. Anything else is left alone.
 */
export function gradeTeamNames<T>(data: T): T {
  const seen = new Set<any>();
  const walk = (node: any) => {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const division = first(node.competition)?.division;
    if (division) {
      for (const side of SIDES) {
        const team = first(node[side]);
        if (team && typeof team.name === "string") team.name = gradedName(team.name, division);
      }
    }
    for (const key of Object.keys(node)) walk(node[key]);
  };
  walk(data);
  return data;
}

/**
 * Wraps the fetch a Supabase client reads through, so every page gets graded
 * names without each one remembering to ask. Only reads whose select asks for
 * a division are touched; everything else passes straight through.
 */
export function gradingFetch(base: typeof fetch): typeof fetch {
  return async (input: any, init?: RequestInit) => {
    const res = await base(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? "";
    const method = (init?.method ?? (typeof input === "object" && input?.method) ?? "GET").toUpperCase();
    if (method !== "GET" || !res.ok || !url.includes("/rest/v1/")) return res;
    let select = "";
    try {
      select = new URL(url).searchParams.get("select") ?? "";
    } catch {
      return res;
    }
    if (!select.includes("division")) return res;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) return res;
    const text = await res.text();
    let body: string = text;
    try {
      body = JSON.stringify(gradeTeamNames(JSON.parse(text)));
    } catch {
      // Not what we expected; hand it on untouched.
    }
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(body, { status: res.status, statusText: res.statusText, headers });
  };
}
