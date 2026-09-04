import { Suspense } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import { CrestField, crestFieldStyles } from "./CrestField";
import { LoginForm } from "./LoginForm";

// Signing in is per-request and the crests come from the database.
export const dynamic = "force-dynamic";

async function clubLogos(): Promise<string[]> {
  try {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("teams")
      .select("logo_url")
      .not("logo_url", "is", null)
      // Retired clubs come off the sign-in screen with everywhere else.
      .neq("is_public", false)
      .eq("team_type", "club")
      .order("name")
      .limit(40);
    return (data ?? []).map((t: any) => t.logo_url).filter(Boolean);
  } catch {
    // The backdrop is decoration. Nobody should be locked out because the
    // crests could not be loaded.
    return [];
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { declined?: string };
}) {
  const logos = await clubLogos();

  return (
    <div className="relative min-h-screen bg-navy-950 flex items-center justify-center px-4 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: crestFieldStyles() }} />
      <CrestField logos={logos} />
      <div className="relative w-full max-w-md">
        {/* Somebody who has just declined the terms is signed out on the spot.
            Landing back here with no explanation reads as a fault. */}
        {searchParams?.declined && (
          <div className="mb-4 bg-navy-900/90 border border-white/15 rounded-lg px-4 py-3 text-sm text-navy-100">
            You have been signed out because you did not agree to the terms.
            Your playing registration is unaffected. Sign in again if you want
            to read them once more.
          </div>
        )}
        <Suspense fallback={<div className="h-[28rem]" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
