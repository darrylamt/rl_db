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
      .order("name")
      .limit(40);
    return (data ?? []).map((t: any) => t.logo_url).filter(Boolean);
  } catch {
    // The backdrop is decoration. Nobody should be locked out because the
    // crests could not be loaded.
    return [];
  }
}

export default async function LoginPage() {
  const logos = await clubLogos();

  return (
    <div className="relative min-h-screen bg-navy-950 flex items-center justify-center px-4 overflow-hidden">
      <style dangerouslySetInnerHTML={{ __html: crestFieldStyles() }} />
      <CrestField logos={logos} />
      <div className="relative w-full max-w-md">
        <Suspense fallback={<div className="h-[28rem]" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
