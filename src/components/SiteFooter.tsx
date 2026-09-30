import Link from "next/link";
import { getNavigation, getSiteSettings } from "@/features/cms/queries";

// Footer links come from Dashboard → Website → Navigation. Links to CMS pages
// that are not published are hidden automatically.
export async function SiteFooter({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const [{ footer }, settings] = await Promise.all([getNavigation(), getSiteSettings()]);
  const dark = tone === "dark";
  const linkClass = dark ? "hover:text-white" : "hover:text-[var(--ink)]";
  return <footer className={dark ? "bg-[var(--ink)] text-white/70" : "border-t border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]"}>
    <div className="container flex flex-col justify-between gap-6 py-6 text-[10px] font-700 uppercase tracking-[.15em] sm:flex-row sm:items-center">
      <span>© {new Date().getFullYear()} 42 Model Management</span>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3">
        {footer.map((item) => item.href.startsWith("/")
          ? <Link key={item.id} href={item.href} prefetch={item.href === "/join" ? false : undefined} className={linkClass}>{item.label}</Link>
          : <a key={item.id} href={item.href} target={item.href.startsWith("https://") ? "_blank" : undefined} rel="noopener noreferrer" className={linkClass}>{item.label}</a>)}
        {settings.instagram_url && <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className={linkClass}>Instagram ↗</a>}
      </nav>
    </div>
  </footer>;
}
