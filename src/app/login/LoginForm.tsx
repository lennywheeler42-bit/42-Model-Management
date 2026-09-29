"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";

export function LoginForm({ nextPath, initialError = "" }: { nextPath: string; initialError?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    window.location.assign(nextPath || "/dashboard");
  }

  async function signInWithGoogle() {
    setLoading(true); setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath || "/dashboard")}`;
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  }

  return <div className="mt-8">
    <button type="button" onClick={signInWithGoogle} disabled={loading} className="flex w-full items-center justify-center gap-3 rounded-md border border-[#d9d5ce] bg-white px-4 py-3 text-[11px] font-800 uppercase tracking-[.14em] text-[#20211f] transition-colors hover:border-[#c26a48] disabled:opacity-50">
      <span className="text-base font-700 normal-case">G</span>
      {loading ? "Connecting…" : "Continue with Google"}
    </button>
    <div className="my-6 flex items-center gap-3 text-[9px] font-800 uppercase tracking-[.18em] text-[#b5b0a7]"><span className="h-px flex-1 bg-[#e7e3dc]" />or<span className="h-px flex-1 bg-[#e7e3dc]" /></div>
    <form onSubmit={submit} className="space-y-4"><label className="block text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">Work email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-md border border-[#e7e7e3] px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#c26a48]" placeholder="you@agency.com" /></label><label className="block text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">Password<input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-md border border-[#e7e7e3] px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-[#c26a48]" placeholder="••••••••" /></label>{error && <p className="rounded-md bg-[#f8e8df] px-3 py-2 text-xs text-[#a9593d]">{error}</p>}<button disabled={loading} className="w-full rounded-md bg-[#20211f] px-4 py-3 text-[11px] font-800 uppercase tracking-[.14em] text-white transition-colors hover:bg-[#c26a48] disabled:opacity-50">{loading ? "Signing in…" : "Sign in with email"}</button></form>
  </div>;
}
