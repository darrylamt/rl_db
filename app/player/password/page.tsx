import { getAppUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { changePassword } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Sitting outside the player layout on purpose.
 *
 * An account that has not changed its password cannot reach anything else,
 * so this page must not depend on the shell that everything else uses.
 */
export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const user = await getAppUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-navy-900 border border-white/10 rounded-lg p-8">
        <p className="text-gold-400 text-xs font-display tracking-widest uppercase">
          Rugby League Federation Ghana
        </p>
        <h1 className="font-display text-2xl font-bold mt-3 mb-2">
          Choose your own password
        </h1>
        <p className="text-navy-200 text-sm mb-6">
          Every player account was set up with the same password, so it is not
          private until you change it. Pick something only you know.
        </p>

        {searchParams?.error && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 text-sm px-3 py-2 rounded mb-4">
            {searchParams.error}
          </div>
        )}

        <form action={changePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-navy-100">
              New password
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded bg-navy-950/80 border border-navy-600 text-white focus:border-gold-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-navy-100">
              Type it again
            </label>
            <input
              type="password"
              name="again"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded bg-navy-950/80 border border-navy-600 text-white focus:border-gold-400 focus:outline-none"
            />
          </div>
          <button className="w-full bg-gold-500 hover:bg-gold-400 text-navy-900 font-semibold px-4 py-2.5 rounded">
            Save it and continue
          </button>
        </form>

        <form action="/admin/logout" method="post" className="mt-6 text-center">
          <button className="text-navy-300 hover:text-white text-xs underline">
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}
