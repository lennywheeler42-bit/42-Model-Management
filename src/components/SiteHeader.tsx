import Link from "next/link";
import { Menu, X } from "lucide-react";
import { getPublicBoards } from "@/features/public/queries";
import { getNavigation } from "@/features/cms/queries";

// Menu: all talent, top-level public boards marked "show in navigation", header
// links from Dashboard → Website → Navigation, then About / Join us / Contact.
export async function SiteHeader({ dark = false }: { dark?: boolean }) {
  const [boards, navigation] = await Promise.all([getPublicBoards(), getNavigation()]);
  const topBoards = boards.filter((board) => board.depth === 0 && board.show_in_navigation);
  const links = [
    { href: "/models", label: "All talent" },
    ...topBoards.map((board) => ({ href: `/models/${board.path}`, label: board.name })),
    ...navigation.header.map((item) => ({ href: item.href, label: item.label })),
    { href: navigation.liveSlugs.has("about") ? "/about" : "/#about", label: "About" },
    { href: "/join", label: "Join us" },
    { href: "/#contact", label: "Contact" },
  ].filter((link, index, all) => all.findIndex((other) => other.href === link.href) === index);
  const item = (link: { href: string; label: string }, className: string) => link.href.startsWith("https://")
    ? <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className={className}>{link.label}</a>
    : <Link key={link.href} href={link.href} prefetch={link.href === "/join" ? false : undefined} className={className}>{link.label}</Link>;

  return (
    <header className={`absolute inset-x-0 top-0 z-20 ${dark ? "text-white" : "text-[var(--ink)]"}`}>
      <div className="container flex h-[88px] items-center justify-between gap-6 border-b border-current/20">
        <Link href="/" className="flex items-center gap-3" aria-label="42 Model Management — home">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-current text-[11px] font-800 tracking-[-.08em]">42</span>
          <span className="hidden text-[11px] font-800 uppercase tracking-[.18em] sm:block">Model Management</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-7 text-[11px] font-700 uppercase tracking-[.16em] lg:flex">
          {links.map((link) => item(link, "transition-opacity hover:opacity-60"))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="hidden rounded-full border border-current/30 px-4 py-2 text-[10px] font-800 uppercase tracking-[.16em] transition-colors hover:bg-white hover:text-[var(--ink)] sm:block">Staff login</Link>
          <details className="group relative lg:hidden">
            <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-current/30 [&::-webkit-details-marker]:hidden" aria-label="Menu">
              <Menu size={16} className="group-open:hidden" aria-hidden /><X size={16} className="hidden group-open:block" aria-hidden />
            </summary>
            <nav aria-label="Mobile" className="absolute right-0 top-12 w-64 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-[var(--ink)] shadow-xl">
              {links.map((link) => item(link, "block rounded-lg px-3 py-2.5 text-[11px] font-800 uppercase tracking-[.14em] hover:bg-[#e6e1d8]"))}
              <Link href="/dashboard" className="mt-2 block rounded-lg border-t border-[var(--line)] px-3 py-2.5 text-[11px] font-800 uppercase tracking-[.14em] text-[var(--muted)]">Staff login</Link>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
