import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TERMS_VERSION } from "@/lib/terms";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    // Env not configured yet — let requests through so the UI can still render.
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isClubRoute = pathname.startsWith("/club");
  // The quick-entry screens write from the browser, so the database only
  // accepts them from a signed-in session. Without this gate a phone that has
  // never signed in reaches the form and every save fails silently.
  const isEnterRoute = pathname.startsWith("/enter");
  const isPlayerRoute = pathname.startsWith("/player");
  const isLoginRoute = pathname === "/admin/login";
  // Signing out lives under /admin but belongs to everyone. Without this it
  // is treated as the federation's admin and a club or recorder is bounced
  // back to their own side before the route can clear the session — leaving
  // them no way to sign out at all.
  const isLogoutRoute = pathname === "/admin/logout";

  if ((isAdminRoute || isClubRoute || isEnterRoute || isPlayerRoute) && !isLoginRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // What kind of account this is decides which half of the app it sees. The
  // middleware only sorts the traffic; every read and write checks again on
  // the server, because a redirect is a convenience and not a permission.
  let role: "federation" | "club" | "recorder" | "player" | "unprovisioned" = "federation";
  let hasRoles = true;
  let onHold = false;
  let mustChange = false;
  let termsVersion: string | null = null;
  let termsColumnPresent = true;
  if (user && (isAdminRoute || isClubRoute || isEnterRoute || isPlayerRoute || isLoginRoute)) {
    // terms_version arrives with supabase/player_terms.sql. Asking for a
    // column that is not there yet fails the whole row, and a null row here
    // reads as "unprovisioned" — which would lock every account out of the
    // app until the migration ran. So it is asked for, and dropped if the
    // database has not caught up.
    let { data, error } = await supabase
      .from("app_users")
      .select("role, status, must_change_password, terms_version")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && (error as any).code === "42703") {
      // No column yet, so there is nothing to hold anybody to. The gate below
      // stays shut off entirely rather than sending every player to a screen
      // whose "I agree" it has nowhere to record — which would be a loop, and
      // a loop here is every player locked out of their own portal.
      termsColumnPresent = false;
      ({ data, error } = await supabase
        .from("app_users")
        .select("role, status, must_change_password")
        .eq("user_id", user.id)
        .maybeSingle());
    }
    if (error && (error as any).code === "42P01") {
      // Roles have not been introduced yet: behave exactly as before.
      hasRoles = false;
    } else if (!data) {
      role = "unprovisioned";
    } else {
      role =
        data.role === "club" || data.role === "recorder" || data.role === "player"
          ? data.role
          : "federation";
      mustChange = (data as any).must_change_password === true;
      termsVersion = (data as any).terms_version ?? null;
      // The column only exists once account_holds_and_audit.sql has run;
      // before that nothing is held, exactly as before.
      onHold = (data as any).status === "on_hold";
    }
  }

  const home =
    role === "club"
      ? "/club"
      : role === "recorder"
      ? "/enter"
      : role === "player"
      ? "/player"
      : "/admin/dashboard";

  if (isLoginRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = home;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // A held account keeps its password and its history but gets no further
  // than this. It is how a club login can exist before their fees are paid.
  if (user && onHold && !isLogoutRoute && pathname !== "/admin/on-hold") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/on-hold";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Every seeded player starts on the same password. Nothing else is
  // reachable until that has been dealt with.
  if (
    user &&
    mustChange &&
    !isLogoutRoute &&
    pathname !== "/player/password"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/player/password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Then what the federation shares about them, which they are asked once per
  // version. After the password on purpose: the first thing anybody does is
  // make the account theirs, and only then are they asked to agree to
  // anything from it.
  if (
    user &&
    role === "player" &&
    !mustChange &&
    termsColumnPresent &&
    termsVersion !== TERMS_VERSION &&
    !isLogoutRoute &&
    pathname !== "/player/terms"
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/player/terms";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && hasRoles && !isLogoutRoute) {
    // A club account has no business in the federation admin.
    if (isAdminRoute && !isLoginRoute && role === "club") {
      const url = request.nextUrl.clone();
      url.pathname = "/club";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Nor the federation in a club's portal — there is nothing there for it.
    if (isClubRoute && role === "federation") {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // A player account gets its own side and nothing else.
    if ((isAdminRoute || isClubRoute || isEnterRoute) && !isLoginRoute && role === "player") {
      const url = request.nextUrl.clone();
      url.pathname = "/player";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // And nobody else has any business there.
    if (isPlayerRoute && role !== "player") {
      const url = request.nextUrl.clone();
      url.pathname = home;
      url.search = "";
      return NextResponse.redirect(url);
    }
    // A recorder gets the match-day screens and nothing else.
    if ((isAdminRoute || isClubRoute) && !isLoginRoute && role === "recorder") {
      const url = request.nextUrl.clone();
      url.pathname = "/enter";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // Signing in is not the same as being allowed to record a match — a club
    // account would otherwise be entering other people's results.
    if (isEnterRoute && (role === "club" || role === "unprovisioned")) {
      const url = request.nextUrl.clone();
      url.pathname = role === "club" ? "/club" : "/admin/no-access";
      url.search = "";
      return NextResponse.redirect(url);
    }
    // An account nobody has set up gets neither, and is told so.
    if ((isAdminRoute || isClubRoute) && !isLoginRoute && role === "unprovisioned") {
      if (pathname !== "/admin/no-access") {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/no-access";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
