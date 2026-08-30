"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  // Where to go afterwards. Left unset, the middleware sorts it out: the
  // federation lands in the admin, a club in its portal, a recorder at match
  // entry. Hardcoding the admin here would bounce everyone else twice.
  const next = search.get("next") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    router.push(next || (await homeFor(supabase, data.user?.id)));
    router.refresh();
  }

  /**
   * Where this account belongs.
   *
   * An account may read its own row in app_users, so the answer is one query
   * away and the landing is right first time. The middleware would sort it
   * out anyway; this just spares everyone a visible bounce through the admin.
   */
  async function homeFor(supabase: ReturnType<typeof createClient>, userId?: string) {
    if (!userId) return "/admin/dashboard";
    const { data, error } = await supabase
      .from("app_users")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    // Roles not introduced yet — every account is the federation's, as before.
    if (error) return "/admin/dashboard";
    if (!data) return "/admin/no-access";
    if (data.role === "club") return "/club";
    if (data.role === "recorder") return "/enter";
    return "/admin/dashboard";
  }

  return (
    <div className="w-full max-w-md bg-navy-900/85 backdrop-blur-md border border-white/10 rounded-lg p-8 shadow-2xl">
      <Link href="/" className="text-gold-400 text-sm font-display tracking-widest hover:underline">
        ← RLFG
      </Link>
      <h1 className="font-display text-3xl font-bold mt-4 mb-6 text-white">Sign In</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-navy-100">Email</label>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded bg-navy-950/80 border border-navy-600 text-white focus:border-gold-400 focus:outline-none"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-navy-100">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded bg-navy-950/80 border border-navy-600 text-white focus:border-gold-400 focus:outline-none"
          />
        </div>
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-200 text-sm px-3 py-2 rounded">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gold-500 hover:bg-gold-400 disabled:bg-gold-700 text-navy-900 font-semibold px-4 py-2.5 rounded transition"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <p className="text-xs text-navy-300 mt-6 text-center">
        Following a match?{" "}
        <Link href="/live" className="text-gold-400 hover:underline">
          The live scores are public
        </Link>{" "}
        — no account needed.
      </p>
    </div>
  );
}
