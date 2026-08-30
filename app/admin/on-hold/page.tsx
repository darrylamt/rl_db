import { getAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Where a held account lands.
 *
 * It says what has happened and what to do about it. The alternative — a
 * sign-in that simply fails — reads as a broken password and generates a
 * phone call the federation then has to work out the answer to.
 */
export default async function OnHoldPage() {
  const user = await getAppUser();

  return (
    <div className="min-h-screen bg-navy-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-navy-900 border border-amber-500/30 rounded-lg p-8">
        <p className="text-amber-400 text-xs font-display tracking-widest uppercase">
          Account on hold
        </p>
        <h1 className="font-display text-2xl font-bold mt-3 mb-3">
          Your access is paused
        </h1>
        <p className="text-navy-200 text-sm">
          {user?.email ? `${user.email} exists and ` : "This account exists and "}
          your password still works — the federation has put it on hold, so it
          cannot be used yet. This normally means a club&apos;s registration
          for the season has not been settled.
        </p>
        <p className="text-navy-300 text-sm mt-4">
          Nothing you have entered has been lost. Contact the federation to
          have the hold lifted.
        </p>
        <form action="/admin/logout" method="post" className="mt-6">
          <button className="text-sm text-navy-300 hover:text-white underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
