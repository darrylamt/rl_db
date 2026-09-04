import { redirect } from "next/navigation";
import { getAppUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { TERMS, TERMS_VERSION } from "@/lib/terms";
import { decideTerms } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Outside the player layout, like the password screen — an account that has
 * not answered this cannot reach the shell everything else is drawn in.
 */
export default async function PlayerTermsPage() {
  const user = await getAppUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "player") redirect("/admin/dashboard");

  const supabase = createAdminClient();
  const { data: player } = user.playerId
    ? await supabase
        .from("players")
        .select("first_name")
        .eq("player_id", user.playerId)
        .maybeSingle()
    : { data: null };

  const firstName = (player as any)?.first_name as string | undefined;

  return (
    <div className="min-h-screen bg-navy-950 text-white px-4 py-8">
      <div className="w-full max-w-2xl mx-auto">
        <p className="text-gold-400 text-xs font-display tracking-widest uppercase">
          Rugby League Federation Ghana
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold mt-3">
          Before you go in{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="text-navy-200 text-sm mt-2">
          This is what the federation holds about you and what it shows other
          people. Read it, then tell us whether you agree.
        </p>

        <div className="mt-6 space-y-5 bg-navy-900 border border-white/10 rounded-lg p-5 md:p-6">
          {TERMS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-base text-gold-400 mb-1.5">
                {section.heading}
              </h2>
              {section.body.map((line, i) => (
                <p key={i} className="text-navy-100 text-sm leading-relaxed mb-2 last:mb-0">
                  {line}
                </p>
              ))}
            </section>
          ))}

          <p className="text-navy-400 text-[11px] pt-2 border-t border-white/10">
            Version {TERMS_VERSION}. If this changes in a way that matters, you
            will be asked again rather than opted in quietly.
          </p>
        </div>

        <form className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            formAction={decideTerms}
            name="decision"
            value="accept"
            className="flex-1 bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-3 rounded"
          >
            I agree
          </button>
          <button
            formAction={decideTerms}
            name="decision"
            value="decline"
            className="flex-1 border border-white/20 hover:border-white/40 text-navy-100 font-medium px-4 py-3 rounded"
          >
            I do not agree
          </button>
        </form>

        <p className="text-navy-400 text-xs mt-3 text-center">
          Saying no signs you out and leaves your playing registration exactly
          as it is.
        </p>
      </div>
    </div>
  );
}
