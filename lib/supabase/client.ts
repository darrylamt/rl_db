import { createBrowserClient } from "@supabase/ssr";

// Fallback values so `next build` / prerender doesn't crash when env is missing.
// In real deploys, NEXT_PUBLIC_* are inlined at build time and override these.
// If you see the placeholder URL in the browser, you forgot to set env vars on Vercel.
const FALLBACK_URL = "https://placeholder.supabase.co";
const FALLBACK_KEY = "placeholder-anon-key";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY
  );
}
