"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") || "/admin/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-navy-800 border border-navy-700 rounded-lg p-8 shadow-2xl">
        <Link href="/" className="text-gold-400 text-sm font-display tracking-widest hover:underline">
          ← GRLF
        </Link>
        <h1 className="font-display text-3xl font-bold mt-4 mb-1">Admin Login</h1>
        <p className="text-navy-200 text-sm mb-6">
          Federation administrators only.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-navy-100">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded bg-navy-900 border border-navy-600 focus:border-gold-400 focus:outline-none"
              placeholder="admin@grlf.org"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-navy-100">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded bg-navy-900 border border-navy-600 focus:border-gold-400 focus:outline-none"
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
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-navy-900" />}>
      <LoginForm />
    </Suspense>
  );
}
