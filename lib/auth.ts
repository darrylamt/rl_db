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
  role: "federation" | "club" | "recorder";
  /** The one club a club account speaks for. Null for the others. */
  teamId: string | null;
  /**
   * False when the account has no row in app_users. Such an account gets
   * nothing — not the admin, not a club — rather than defaulting to either.
   */
  provisioned: boolean;
  /**
   * A held account keeps its password and its history but cannot get past
   * the sign-in. Used while a club's registration is unpaid.
   */
  onHold: boolean;
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
    .select("role, team_id, status")
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
      onHold: false,
    };
  }

  if (!data) {
    return {
      userId: user.id,
      email: user.email ?? null,
      role: "federation",
      teamId: null,
      provisioned: false,
      onHold: false,
    };
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role:
      data.role === "club" || data.role === "recorder"
        ? data.role
        : "federation",
    teamId: data.team_id ?? null,
    provisioned: true,
    // The column arrives only once account_holds_and_audit.sql has been run;
    // until then nothing is held, which is how things behaved before.
    onHold: (data as any).status === "on_hold",
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
  if (user.onHold) throw new Error("This account is on hold");
  if (user.role !== "club" || !user.teamId) {
    throw new Error("This account is not attached to a club");
  }
  return { user, teamId: user.teamId };
}

export async function requireFederation(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) throw new Error("Not signed in");
  if (!user.provisioned) throw new Error("This account has not been set up");
  if (user.onHold) throw new Error("This account is on hold");
  if (user.role !== "federation") throw new Error("Federation accounts only");
  return user;
}

/**
 * Whoever may type a match in.
 *
 * Recorders exist for exactly this and the federation can do everything, so
 * both pass. A club account does not — it would be recording other people's
 * matches, and its own club's besides.
 */
export async function requireMatchRecorder(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) throw new Error("Not signed in");
  if (!user.provisioned) throw new Error("This account has not been set up");
  if (user.onHold) throw new Error("This account is on hold");
  if (user.role !== "recorder" && user.role !== "federation") {
    throw new Error("Match entry is for recorders and the federation");
  }
  return user;
}
