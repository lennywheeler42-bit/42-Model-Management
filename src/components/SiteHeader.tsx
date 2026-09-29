import Link from "next/link";

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  return (
    <header className={`absolute inset-x-0 top-0 z-20 ${dark ? "text-white" : "text-[var(--ink)]"}`}>
      <div className="container flex h-[88px] items-center justify-between border-b border-current/20">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current text-[11px] font-800 tracking-[-.08em]">42</span>
          <span className="hidden text-[11px] font-800 uppercase tracking-[.18em] sm:block">Model Management</span>
        </Link>
        <nav className="hidden items-center gap-8 text-[11px] font-700 uppercase tracking-[.16em] md:flex">
          <Link className="transition-opacity hover:opacity-60" href="/models">Models</Link>
          <Link className="transition-opacity hover:opacity-60" href="/#about">About</Link>
          <Link className="transition-opacity hover:opacity-60" href="/#contact">Contact</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="rounded-full border border-current/30 px-4 py-2 text-[10px] font-800 uppercase tracking-[.16em] transition-colors hover:bg-white hover:text-[var(--ink)]">Agency OS</Link>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current/30 md:hidden">☰</span>
        </div>
      </div>
    </header>
  );
}
