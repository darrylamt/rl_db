import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NoAccessPage() {
  return (
    <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-navy-800 border border-navy-700 rounded-lg p-8 shadow-2xl">
        <p className="text-gold-400 font-display tracking-widest text-xs">RLFG</p>
        <h1 className="font-display text-2xl font-bold mt-3 mb-2">
          This account is not set up yet
        </h1>
        <p className="text-navy-200 text-sm leading-relaxed">
          You are signed in, but the account has not been given a role. Until
          the federation attaches it to a club — or marks it as a federation
          account — there is nothing here to show you.
        </p>
        <p className="text-navy-300 text-xs mt-4 leading-relaxed">
          If you are expecting access to a club&apos;s squad, ask the federation
          to issue the account from Club Accounts.
        </p>
        <Link
          href="/admin/login"
          className="inline-block mt-6 text-gold-400 text-sm hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
