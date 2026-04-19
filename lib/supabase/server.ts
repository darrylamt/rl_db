import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Fallbacks so build-time prerender doesn't crash if env is missing.
const FALLBACK_URL = "https://placeholder.supabase.co";
const FALLBACK_ANON = "placeholder-anon-key";
const FALLBACK_SERVICE = "placeholder-service-key";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` called from Server Component: ignore (middleware refreshes session)
          }
        },
      },
    }
  );
}

import { createClient as createAdminClient_ } from "@supabase/supabase-js";

// Admin client — uses the service role key. NEVER expose to the browser.
export function createAdminClient() {
  return createAdminClient_(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || FALLBACK_SERVICE,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
