import Link from "next/link";
import { CLINIC, OPENING_HOURS } from "@/lib/clinic";
import type { Dict, Locale } from "@/lib/i18n";
import { Icon, Logo } from "./Icons";

export function Footer({ locale, d }: { locale: Locale; d: Dict }) {
  return (
    <footer className="mt-24 bg-ink text-white/80">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-lg font-bold text-white">Mira Dental Studio</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">{d.meta.description}</p>
        </div>
        <div className="text-sm">
          <p className="mb-3 font-semibold text-white">{d.hours.title}</p>
          <ul className="space-y-1.5">
            {[1, 2, 3, 4, 5, 6, 0].map((i) => (
              <li key={i} className="flex justify-between gap-6">
                <span className="text-white/60">{d.hours.days[i]}</span>
                <span dir="ltr">{OPENING_HOURS[i] ? `${OPENING_HOURS[i]!.open}–${OPENING_HOURS[i]!.close}` : d.hours.closed}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-white">{d.nav.contact}</p>
          <p className="flex gap-2">
            <Icon.Pin size={18} className="mt-0.5 shrink-0 text-white/50" />
            {CLINIC.address[locale]}
          </p>
          <p className="flex gap-2" dir="ltr">
            <Icon.Phone size={18} className="shrink-0 text-white/50" />
            {CLINIC.phone}
          </p>
          <Link href={`/${locale}/book`} className="inline-block rounded-full bg-white px-4 py-2 font-semibold text-ink">
            {d.nav.book}
          </Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-white/50 sm:flex-row sm:justify-between">
          <span>{d.concept}</span>
          <a href="https://github.com/Mhamadjardani" target="_blank" rel="noreferrer" className="hover:text-white">
            {d.footer.made}
          </a>
        </div>
      </div>
    </footer>
  );
}
