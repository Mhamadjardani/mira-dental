import Link from "next/link";
import { CLINIC, DENTISTS, OPENING_HOURS, SERVICES, type Dentist, type Service } from "@/lib/clinic";
import type { Dict, Locale } from "@/lib/i18n";
import { Icon, ServiceIcon } from "./Icons";
import { Reveal } from "./Reveal";

export function SectionHead({ title, lead, center = false }: { title: string; lead?: string; center?: boolean }) {
  return (
    <Reveal className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {lead && <p className="mt-3 text-lg leading-relaxed text-muted">{lead}</p>}
    </Reveal>
  );
}

export const price = (s: Service, d: Dict) => (s.priceUsd ? `$${s.priceUsd}` : d.services.free);

export function ServiceCard({ s, d, locale, i = 0 }: { s: Service; d: Dict; locale: Locale; i?: number }) {
  return (
    <Reveal delay={(i % 3) * 0.06} className="h-full">
      <article className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-6 transition hover:-translate-y-1 hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5">
        <div className="flex items-start justify-between">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-brand-dark transition group-hover:bg-brand group-hover:text-white">
            <ServiceIcon name={s.icon} />
          </span>
          <span className="text-end">
            <span className="block text-xl font-bold">{price(s, d)}</span>
            <span className="block text-xs text-muted">
              <span dir="ltr">{s.duration}</span> {d.services.minutes}
            </span>
          </span>
        </div>
        <h3 className="mt-5 text-lg font-semibold">{s.name[locale]}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{s.description[locale]}</p>
        <Link
          href={`/${locale}/book?service=${s.id}`}
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
        >
          {d.services.book} <Icon.Arrow size={16} />
        </Link>
      </article>
    </Reveal>
  );
}

export function DentistCard({ doc, d, locale, i = 0 }: { doc: Dentist; d: Dict; locale: Locale; i?: number }) {
  const days = doc.days.map((x) => d.hours.days[x].slice(0, locale === "ar" ? undefined : 3)).join(" · ");
  return (
    <Reveal delay={i * 0.08} className="h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface">
        <div
          className="relative flex h-44 items-end p-5"
          style={{ background: `linear-gradient(135deg, hsl(${doc.hue} 55% 88%), hsl(${doc.hue + 30} 60% 94%))` }}
        >
          <svg className="absolute end-4 top-4 h-24 w-24 opacity-30" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="46" fill="none" stroke={`hsl(${doc.hue} 50% 40%)`} strokeDasharray="2 6" />
          </svg>
          <span
            className="grid h-20 w-20 place-items-center rounded-full border-4 border-surface text-2xl font-bold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, hsl(${doc.hue} 55% 42%), hsl(${doc.hue + 25} 55% 32%))` }}
            aria-hidden
          >
            {doc.initials}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-6">
          <h3 className="text-lg font-semibold">{doc.name}</h3>
          <p className="text-sm font-medium text-brand">{doc.role[locale]}</p>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{doc.bio[locale]}</p>
          <dl className="mt-4 space-y-1 text-xs">
            <div className="flex gap-2">
              <dt className="text-muted">{d.team.works}:</dt>
              <dd className="font-medium">{days}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">{d.team.speaks}:</dt>
              <dd className="font-medium">{doc.languages.join(" · ")}</dd>
            </div>
          </dl>
          <Link
            href={`/${locale}/book?service=${doc.services[0]}&dentist=${doc.id}`}
            className="mt-5 rounded-full border border-line px-4 py-2.5 text-center text-sm font-semibold transition hover:border-brand hover:text-brand"
          >
            {d.team.bookWith} {doc.name.split(" ").slice(0, 2).join(" ")}
          </Link>
        </div>
      </article>
    </Reveal>
  );
}

export function HoursAndMap({ d, locale }: { d: Dict; locale: Locale }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <Reveal className="rounded-3xl border border-line bg-surface p-7">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <Icon.Clock size={20} className="text-brand" /> {d.hours.title}
        </h3>
        <ul className="mt-5 divide-y divide-line text-sm">
          {[1, 2, 3, 4, 5, 6, 0].map((i) => (
            <li key={i} className="flex justify-between py-2.5">
              <span className="text-muted">{d.hours.days[i]}</span>
              <span className={`font-medium ${OPENING_HOURS[i] ? "" : "text-coral"}`} dir="ltr">
                {OPENING_HOURS[i] ? `${OPENING_HOURS[i]!.open} – ${OPENING_HOURS[i]!.close}` : d.hours.closed}
              </span>
            </li>
          ))}
        </ul>
        <a href={`tel:${CLINIC.phone.replace(/\s/g, "")}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white">
          <Icon.Phone size={16} /> {d.hours.call} <span dir="ltr">{CLINIC.phone}</span>
        </a>
      </Reveal>
      <Reveal delay={0.08} className="relative min-h-72 overflow-hidden rounded-3xl border border-line bg-[#e9efe9]">
        <MapArt />
        <div className="absolute inset-x-5 bottom-5 flex items-start gap-3 rounded-2xl bg-surface/95 p-4 shadow-lg backdrop-blur">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Icon.Pin size={20} />
          </span>
          <div>
            <p className="text-sm font-semibold">{d.hours.find}</p>
            <p className="text-sm text-muted">{CLINIC.address[locale]}</p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** A stylised street map (decorative, no external map service). */
function MapArt() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 360" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="600" height="360" fill="#e9efe9" />
      <path d="M0 250 C120 230 200 280 330 250 S520 200 600 220 L600 360 L0 360Z" fill="#cfe3ea" />
      <g stroke="#fff" strokeWidth="14" fill="none" strokeLinecap="round">
        <path d="M-10 120 L620 80" />
        <path d="M180 -10 L240 380" />
        <path d="M420 -10 L380 260" />
      </g>
      <g stroke="#fff" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9">
        <path d="M-10 190 L620 170" />
        <path d="M60 -10 L110 260" />
        <path d="M520 -10 L560 230" />
        <path d="M300 -10 L320 240" />
      </g>
      <g fill="#dbe6dc">
        <rect x="120" y="20" width="50" height="45" rx="6" />
        <rect x="255" y="20" width="35" height="50" rx="6" />
        <rect x="440" y="100" width="70" height="55" rx="6" />
        <rect x="130" y="135" width="40" height="40" rx="6" />
        <rect x="335" y="105" width="40" height="55" rx="6" />
      </g>
      <g transform="translate(300 128)">
        <circle r="34" fill="#0f766e" opacity="0.15">
          <animate attributeName="r" values="18;38;18" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <path d="M0 14s-16-14-16-26a16 16 0 0 1 32 0C16 0 0 14 0 14Z" fill="#0f766e" transform="translate(0 -14)" />
        <circle r="6" cy="-26" fill="#fff" />
      </g>
    </svg>
  );
}

export function CtaBand({ d, locale }: { d: Dict; locale: Locale }) {
  return (
    <Reveal>
      <div className="relative overflow-hidden rounded-[2rem] bg-brand px-8 py-14 text-white sm:px-14">
        <div className="blob absolute -end-20 -top-24 h-72 w-72 rounded-full bg-emerald-300" />
        <div className="blob absolute -bottom-28 start-1/3 h-72 w-72 rounded-full bg-cyan-300" />
        <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{d.ctaBand.title}</h2>
            <p className="mt-2 text-lg text-white/80">{d.ctaBand.lead}</p>
          </div>
          <Link href={`/${locale}/book`} className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-semibold text-brand-dark shadow-lg">
            {d.ctaBand.cta} <Icon.Arrow size={18} />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

export { SERVICES, DENTISTS };
