"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Icon, Logo } from "./Icons";
import { LOCALES, LOCALE_LABEL, type Dict, type Locale } from "@/lib/i18n";

export function Header({ locale, nav }: { locale: Locale; nav: Dict["nav"] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rest = pathname.replace(/^\/(en|ar|fr)/, "") || "";
  const links = [
    { href: `/${locale}`, label: nav.home, match: rest === "" },
    { href: `/${locale}/services`, label: nav.services, match: rest.startsWith("/services") },
    { href: `/${locale}/dentists`, label: nav.team, match: rest.startsWith("/dentists") },
    { href: `/${locale}/manage`, label: nav.manage, match: rest.startsWith("/manage") },
    { href: `/${locale}/contact`, label: nav.contact, match: rest.startsWith("/contact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href={`/${locale}`} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Logo />
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight">Mira</span>
            <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Dental Studio</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${l.match ? "bg-mint text-brand-dark" : "text-muted hover:text-ink"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-line bg-surface p-0.5 text-xs font-semibold" dir="ltr">
            {LOCALES.map((l) => (
              <Link
                key={l}
                href={`/${l}${rest}`}
                hrefLang={l}
                aria-current={l === locale ? "true" : undefined}
                className={`rounded-full px-2.5 py-1.5 transition-colors ${l === locale ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
              >
                {LOCALE_LABEL[l]}
              </Link>
            ))}
          </div>
          <Link
            href={`/${locale}/book`}
            className="hidden rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand/30 transition hover:bg-brand-dark sm:inline-block"
          >
            {nav.book}
          </Link>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface lg:hidden"
          >
            {open ? <Icon.Close size={18} /> : <Icon.Menu size={18} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-bg lg:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col px-5 py-3">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="border-b border-line py-3.5 text-base font-medium last:border-0">
                  {l.label}
                </Link>
              ))}
              <Link
                href={`/${locale}/book`}
                onClick={() => setOpen(false)}
                className="mt-3 rounded-full bg-brand px-4 py-3 text-center font-semibold text-white"
              >
                {nav.book}
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
