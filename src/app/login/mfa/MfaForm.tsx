"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authButton, authError, authInput, authLabel } from "../AuthShell";

type Setup = { factorId: string; qr: string; secret: string };

export function MfaForm({ next, email }: { next: string; email: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"loading" | "verify" | "enroll" | "error">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = createClient();
      const { data, error: listError } = await client.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) { setMode("error"); setError("Two-step sign-in is not available right now. Try again, or contact the owner."); return; }
      const verified = data.totp.find((factor) => factor.status === "verified");
      if (verified) { setFactorId(verified.id); setMode("verify"); return; }
      // Clear half-finished setups, then start a new one.
      for (const factor of data.all.filter((item) => item.status === "unverified")) await client.auth.mfa.unenroll({ factorId: factor.id });
      const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `42 dashboard ${new Date().toISOString().slice(0, 10)}` });
      if (cancelled) return;
      if (enrollError || !enrolled) { setMode("error"); setError("Two-step sign-in could not be set up. Ask the owner to check that MFA is enabled in Supabase Auth."); return; }
      setSetup({ factorId: enrolled.id, qr: enrolled.totp.qr_code, secret: enrolled.totp.secret });
      setFactorId(enrolled.id);
      setMode("enroll");
    })();
    return () => { cancelled = true; };
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true); setError("");
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s/g, "") });
    setBusy(false);
    if (verifyError) { setError("That code did not work. Check the time on your phone and try the newest code."); return; }
    router.push(next);
    router.refresh();
  }

  if (mode === "loading") return <p className="mt-8 text-sm text-[#8d8f88]">Loading…</p>;
  if (mode === "error") return <p className={`mt-8 ${authError}`} role="alert">{error}</p>;

  return <form onSubmit={verify} className="mt-8 space-y-4">
    {mode === "enroll" && setup && <div className="space-y-3 rounded-lg border border-[#e7e3dc] p-4 text-sm">
      <p><strong>1.</strong> Scan this code with your authenticator app{email ? ` (account: ${email})` : ""}.</p>
      {/* Supabase returns the QR code as an SVG data URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={setup.qr} alt="QR code for your authenticator app" className="mx-auto h-44 w-44" />
      <p className="text-xs text-[#8d8f88]">Can’t scan? Enter this key: <code className="break-all font-mono text-[#20211f]">{setup.secret}</code></p>
      <p><strong>2.</strong> Enter the 6-digit code it shows.</p>
    </div>}
    <label className={authLabel}>6-digit code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} value={code} onChange={(event) => setCode(event.target.value)} className={`${authInput} text-center font-mono text-lg tracking-[.4em]`} placeholder="000000" /></label>
    {error && <p className={authError} role="alert">{error}</p>}
    <button disabled={busy} className={authButton}>{busy ? "Checking…" : mode === "enroll" ? "Turn on two-step sign-in" : "Continue"}</button>
  </form>;
}
