import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  const isLoginRoute = pathname === "/admin/login";
  // Signing out lives under /admin but belongs to everyone. Without this it
  // is treated as the federation's admin and a club or recorder is bounced
  // back to their own side before the route can clear the session — leaving
  // them no way to sign out at all.
  const isLogoutRoute = pathname === "/admin/logout";

  if ((isAdminRoute || isClubRoute || isEnterRoute) && !isLoginRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // What kind of account this is decides which half of the app it sees. The
  // middleware only sorts the traffic; every read and write checks again on
  // the server, because a redirect is a convenience and not a permission.
  let role: "federation" | "club" | "recorder" | "unprovisioned" = "federation";
  let hasRoles = true;
  let onHold = false;
  if (user && (isAdminRoute || isClubRoute || isEnterRoute || isLoginRoute)) {
    const { data, error } = await supabase
      .from("app_users")
      .select("role, status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && (error as any).code === "42P01") {
      // Roles have not been introduced yet: behave exactly as before.
      hasRoles = false;
    } else if (!data) {
      role = "unprovisioned";
    } else {
      role =
        data.role === "club" || data.role === "recorder"
          ? data.role
          : "federation";
      // The column only exists once account_holds_and_audit.sql has run;
      // before that nothing is held, exactly as before.
      onHold = (data as any).status === "on_hold";
    }
  }

  const home =
    role === "club" ? "/club" : role === "recorder" ? "/enter" : "/admin/dashboard";

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
