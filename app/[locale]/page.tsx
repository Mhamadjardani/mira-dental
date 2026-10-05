import Link from "next/link";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import { DENTISTS, SERVICES } from "@/lib/clinic";
import { Icon, ServiceIcon } from "@/components/Icons";
import { Reveal } from "@/components/Reveal";
import { AskMiraButton, NextAvailable } from "@/components/bits";
import { CtaBand, DentistCard, HoursAndMap, SectionHead, ServiceCard } from "@/components/sections";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  const [line1, line2] = d.hero.title.split("\n");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="blob pointer-events-none absolute -start-32 top-10 h-96 w-96 rounded-full bg-mint" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-surface px-3 py-1.5 text-xs font-semibold text-brand-dark">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" /> {d.hero.eyebrow}
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
                {line1}
                <br />
                <span className="text-brand">{line2}</span>
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">{d.hero.lead}</p>
            </Reveal>
            <Reveal delay={0.18}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/book`}
                  className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark"
                >
                  <Icon.Calendar size={18} /> {d.hero.cta}
                </Link>
                <AskMiraButton
                  label={d.hero.ask}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-6 py-3.5 font-semibold transition hover:border-brand hover:text-brand"
                />
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-6">
                {[
                  ["48h", d.hero.stat1],
                  ["3", d.hero.stat2],
                  ["$0", d.hero.stat3],
                ].map(([v, l]) => (
                  <div key={l}>
                    <dt className="text-2xl font-bold" dir="ltr">
                      {v}
                    </dt>
                    <dd className="mt-1 text-xs leading-snug text-muted">{l}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="relative">
            <HeroArt />
            <div className="absolute -bottom-5 start-0 sm:-start-6">
              <NextAvailable locale={locale} />
            </div>
            <div className="absolute -top-4 end-2 hidden max-w-[230px] space-y-2 sm:block">
              <div className="ms-auto w-fit rounded-2xl rounded-se-md bg-brand px-3.5 py-2 text-xs text-white shadow-lg">
                {locale === "ar" ? "في موعد تبييض الخميس؟" : locale === "fr" ? "Un blanchiment jeudi ?" : "Whitening on Thursday?"}
              </div>
              <div className="w-fit rounded-2xl rounded-ss-md bg-surface px-3.5 py-2 text-xs shadow-lg">
                {locale === "ar" ? "أكيد! ١١:٠٠ أو ١٤:٣٠ متاحان." : locale === "fr" ? "Oui ! 11:00 ou 14:30 sont libres." : "Yes! 11:00 or 14:30 are free."}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead title={d.services.title} lead={d.services.lead} />
          <Link href={`/${locale}/services`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
            {d.services.all} <Icon.Arrow size={16} />
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.slice(0, 6).map((s, i) => (
            <ServiceCard key={s.id} s={s} d={d} locale={locale} i={i} />
          ))}
        </div>
      </section>

      {/* Why us */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-[2rem] bg-sand px-6 py-14 sm:px-12">
          <SectionHead title={d.why.title} center />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {d.why.items.map((it, i) => (
              <Reveal key={it.t} delay={i * 0.06}>
                <div className="h-full rounded-3xl bg-surface p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-sm font-bold text-white" dir="ltr">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold">{it.t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{it.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <SectionHead title={d.team.title} lead={d.team.lead} />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {DENTISTS.map((doc, i) => (
            <DentistCard key={doc.id} doc={doc} d={d} locale={locale} i={i} />
          ))}
        </div>
      </section>

      {/* Hours & map */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <HoursAndMap d={d} locale={locale} />
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-8">
        <CtaBand d={d} locale={locale} />
      </section>
    </>
  );
}

/** Hero illustration: a calm composition built from shapes (no stock photos). */
function HeroArt() {
  return (
    <div className="relative aspect-[5/4] overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-mint via-[#eaf6f2] to-sand shadow-2xl shadow-brand/10">
      <svg viewBox="0 0 500 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="tooth" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e6f1ee" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.45" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="250" cy="190" r="170" fill="url(#glow)" />
        <circle cx="250" cy="190" r="140" fill="none" stroke="#0f766e" strokeOpacity="0.12" strokeDasharray="3 9" />
        <circle cx="250" cy="190" r="105" fill="none" stroke="#0f766e" strokeOpacity="0.1" />
        <g transform="translate(250 196)">
          <path
            d="M-62 -78c-30 0-48 25-44 58 4 34 18 50 25 86 6 30 12 52 28 52 18 0 21-28 27-52 5-19 11-30 26-30s21 11 26 30c6 24 9 52 27 52 16 0 22-22 28-52 7-36 21-52 25-86 4-33-14-58-44-58-25 0-37 16-62 16s-37-16-62-16Z"
            fill="url(#tooth)"
            stroke="#0f766e"
            strokeOpacity="0.18"
            strokeWidth="2"
          />
          <path d="M-58 -50c10-12 24-16 36-12" stroke="#fff" strokeWidth="8" strokeLinecap="round" fill="none" />
          <path d="M-28 4c18 14 38 14 56 0" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" fill="none" />
          <circle cx="-26" cy="-22" r="6" fill="#10292c" />
          <circle cx="26" cy="-22" r="6" fill="#10292c" />
        </g>
        <g fill="#0f766e">
          <path d="M392 92l5 14 14 5-14 5-5 14-5-14-14-5 14-5z" opacity="0.8" />
          <path d="M120 270l3.5 9 9 3.5-9 3.5-3.5 9-3.5-9-9-3.5 9-3.5z" opacity="0.6" />
          <path d="M418 268l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#e8775a" />
        </g>
      </svg>
    </div>
  );
}

export { ServiceIcon };
