"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { requireFederation, getAppUser } from "@/lib/auth";
import { award, getRules } from "@/lib/credits";
import { runCreditSweep } from "@/lib/creditSweep";

const PAGE = "/admin/credits";

function describe(message: string) {
  if (/club_credits|credit_rules|credit_settings/.test(message) && /does not exist|relation/i.test(message)) {
    return "Run supabase/club_credits.sql first.";
  }
  return message;
}

function done(outcome: { error: string } | { note: string }, season?: string) {
  const params = new URLSearchParams(outcome as any);
  if (season) params.set("season", season);
  revalidatePath(PAGE);
  revalidatePath("/club/credits");
  redirect(`${PAGE}?${params}`);
}

/**
 * Awards or deducts by hand.
 *
 * Two thirds of the regulations are things no database can see — dues paid,
 * an AGM held, a coach qualified — so this is the main way credits move, not
 * a fallback.
 */
export async function awardCredit(fd: FormData) {
  await requireFederation();
  const user = await getAppUser();

  const teamId = ((fd.get("team_id") as string) ?? "").trim();
  const code = ((fd.get("code") as string) ?? "").trim();
  const season = ((fd.get("season") as string) ?? "").trim();
  const note = ((fd.get("note") as string) ?? "").trim() || null;
  const override = ((fd.get("amount") as string) ?? "").trim();

  if (!teamId || !code || !season) {
    done({ error: "Pick a club, a reason and a season." }, season);
  }

  const rules = await getRules();
  const rule = rules.find((r) => r.code === code);
  if (!rule) done({ error: "That is not a credit reason." }, season);

  const amount = override ? parseInt(override, 10) : rule!.amount;
  if (Number.isNaN(amount)) done({ error: "That amount is not a number." }, season);

  // A capped reason must not be awarded past its cap by hand either — the cap
  // is the regulation, not a guard on the sweep.
  if (rule!.season_cap != null) {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from("club_credits")
      .select("entry_id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("season", season)
      .eq("code", code);
    if ((count ?? 0) >= rule!.season_cap) {
      done(
        {
          error: `${rule!.label} is capped at ${rule!.season_cap} for a season, and that is already reached.`,
        },
        season
      );
    }
  }

  const res = await award({
    teamId,
    season,
    code,
    amount,
    description: rule!.label,
    note,
    awardedBy: user?.userId ?? null,
    automatic: false,
  });

  done(
    res.ok
      ? { note: `${rule!.label}: ${amount > 0 ? "+" : ""}${amount} recorded.` }
      : { error: describe(res.error ?? "Could not record that.") },
    season
  );
}

/**
 * Reverses an entry.
 *
 * The original is left where it is and an opposite entry is written beside
 * it. A ledger a mistake can be deleted from is not a ledger — the club is
 * entitled to see that something was awarded and then taken back, and why.
 */
export async function reverseCredit(entryId: string, fd: FormData) {
  await requireFederation();
  const user = await getAppUser();
  const supabase = createAdminClient();
  const why = ((fd.get("why") as string) ?? "").trim() || "Reversed by the federation";

  const { data: entry } = await supabase
    .from("club_credits")
    .select("team_id, season, code, amount, description")
    .eq("entry_id", entryId)
    .maybeSingle();

  if (!entry) done({ error: "That entry no longer exists." });

  const e = entry as any;
  const res = await award({
    teamId: e.team_id,
    season: e.season,
    code: e.code,
    amount: -e.amount,
    description: `Reversal — ${e.description}`,
    note: why,
    awardedBy: user?.userId ?? null,
    automatic: false,
  });

  done(
    res.ok
      ? { note: `Reversed: ${e.description}.` }
      : { error: describe(res.error ?? "Could not reverse that.") },
    e.season
  );
}

/** Settles everything the system can work out for itself. */
export async function sweepSeason(season: string) {
  await requireFederation();
  const user = await getAppUser();

  try {
    const r = await runCreditSweep(season, user?.userId ?? null);
    const parts = [
      `${r.added} added`,
      r.alreadyThere > 0 ? `${r.alreadyThere} already there` : null,
      r.flagged.length > 0 ? `${r.flagged.length} need your decision` : null,
      r.errors.length > 0 ? `${r.errors.length} failed` : null,
    ].filter(Boolean);
    done({ note: `${season}: ${parts.join(", ")}.` }, season);
  } catch (err: any) {
    done({ error: describe(err?.message ?? String(err)) }, season);
  }
}
