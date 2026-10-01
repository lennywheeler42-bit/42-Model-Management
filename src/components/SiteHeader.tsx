import Link from "next/link";
import { Search } from "lucide-react";
import { getPublicBoards } from "@/features/public/queries";
import { getNavigation, getSiteSettings } from "@/features/cms/queries";
import { SiteMenu } from "./SiteMenu";

// Menu: all talent, top-level public boards marked "show in navigation", header
// links from Dashboard → Website → Navigation, then About / Join us / Contact.
// Desktop shows the short list inline; the full-screen menu has everything.
export async function SiteHeader({ dark = false }: { dark?: boolean }) {
  const [boards, navigation, settings] = await Promise.all([getPublicBoards(), getNavigation(), getSiteSettings()]);
  const topBoards = boards.filter((board) => board.depth === 0 && board.show_in_navigation);
  const links = [
    { href: "/models", label: "Models" },
    ...topBoards.map((board) => ({ href: `/models/${board.path}`, label: board.name })),
    ...navigation.header.map((item) => ({ href: item.href, label: item.label })),
    { href: navigation.liveSlugs.has("about") ? "/about" : "/#about", label: "About" },
    { href: "/join", label: "Join us" },
    { href: "/#contact", label: "Contact" },
  ].filter((link, index, all) => all.findIndex((other) => other.href === link.href) === index);
  const inline = links.filter((link) => link.href !== "/join").slice(0, 6);
  const item = (link: { href: string; label: string }) => link.href.startsWith("https://")
    ? <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-60">{link.label}</a>
    : <Link key={link.href} href={link.href} className="transition-opacity hover:opacity-60">{link.label}</Link>;

  return (
    <header className={`absolute inset-x-0 top-0 z-30 ${dark ? "text-white" : "text-[var(--ink)]"}`}>
      <div className="container grid h-[88px] grid-cols-[1fr_auto] items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex w-fit flex-col items-start leading-none" aria-label="42 Model Management, home">
          <span className="display text-[34px] leading-[.85] tracking-[-.02em] sm:text-[40px]">42</span>
          <span className="mt-1.5 text-[8px] font-500 uppercase tracking-[.32em] sm:text-[9px]">Model Management</span>
        </Link>
        <nav aria-label="Main" className="label hidden items-center gap-9 lg:flex">{inline.map(item)}</nav>
        <div className="flex items-center justify-end gap-1">
          <Link href="/models#search" aria-label="Search talent" className="flex h-10 w-10 items-center justify-center transition-opacity hover:opacity-60"><Search size={20} strokeWidth={1.25} aria-hidden /></Link>
          <SiteMenu links={links} email={settings.contact_email} />
        </div>
      </div>
    </header>
  );
}
