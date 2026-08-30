import { createClient, createAdminClient } from "@/lib/supabase/server";

/**
 * Who is signed in, and what they are allowed to be.
 *
 * The admin used to be gated on being signed in and nothing more, which was
 * workable while every account belonged to the federation. Clubs having their
 * own logins ends that, so an account now has to say what it is.
 */
export type AppUser = {
  userId: string;
  email: string | null;
  role: "federation" | "club";
  /** The one club a club account speaks for. Null for the federation. */
  teamId: string | null;
  /**
   * False when the account has no row in app_users. Such an account gets
   * nothing — not the admin, not a club — rather than defaulting to either.
   */
  provisioned: boolean;
};

/**
 * Resolves the signed-in account, or null when nobody is.
 *
 * If app_users does not exist yet — the migration has not been run — every
 * signed-in account is treated as the federation, which is exactly how things
 * behaved before. That keeps deploying this ahead of the migration from
 * locking anyone out. Once the table is there it is the authority, and an
 * account without a row is refused.
 */
export async function getAppUser(): Promise<AppUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Read with the service key: an account needs to learn its own role before
  // any policy could be evaluated for it.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_users")
    .select("role, team_id")
    .eq("user_id", user.id)
    .maybeSingle();

  // 42P01 is "relation does not exist" — the migration has not been run.
  if (error && (error as any).code === "42P01") {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: "federation",
      teamId: null,
      provisioned: true,
    };
  }

  if (!data) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: "federation",
      teamId: null,
      provisioned: false,
    };
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: data.role === "club" ? "club" : "federation",
    teamId: data.team_id ?? null,
    provisioned: true,
  };
}

/**
 * The club this request is allowed to act for, or null.
 *
 * Every club-side read and write goes through this rather than trusting a
 * team id from a form — a posted id is the caller's claim, not a fact.
 */
export async function requireClub(): Promise<{ user: AppUser; teamId: string }> {
  const user = await getAppUser();
  if (!user) throw new Error("Not signed in");
  if (user.role !== "club" || !user.teamId) {
    throw new Error("This account is not attached to a club");
  }
  return { user, teamId: user.teamId };
}

export async function requireFederation(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) throw new Error("Not signed in");
  if (!user.provisioned) throw new Error("This account has not been set up");
  if (user.role !== "federation") throw new Error("Federation accounts only");
  return user;
}
