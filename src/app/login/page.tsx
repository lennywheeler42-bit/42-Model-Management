import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const nextPath = params.next?.startsWith("/") ? params.next : "/dashboard";
  const initialError = params.error === "not_authorized" ? "This email is not approved for the agency dashboard. Ask the owner to add it under Team access." : params.error === "oauth_callback_failed" ? "Google sign-in could not be completed. Please try again." : "";
  return <main className="grid min-h-screen place-items-center bg-[#f5f3ef] p-6"><div className="w-full max-w-md rounded-2xl border border-[#e7e3dc] bg-white p-8 shadow-sm sm:p-10"><Link href="/" className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#20211f] text-[11px] font-800 tracking-[-.08em]">42</span><span className="text-[10px] font-800 uppercase tracking-[.16em]">Model Management</span></Link><p className="mt-14 text-[10px] font-800 uppercase tracking-[.2em] text-[#c26a48]">Private workspace</p><h1 className="mt-3 text-3xl font-700 tracking-[-.04em]">Welcome back.</h1><p className="mt-3 text-sm leading-6 text-[#8d8f88]">Sign in with your agency account to manage talent, media, boards, and publishing.</p><LoginForm nextPath={nextPath} initialError={initialError} /><Link href="/" className="mt-6 block text-center text-[10px] font-800 uppercase tracking-[.14em] text-[#8d8f88]">← Back to public site</Link></div></main>;
}
