import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import { CLINIC } from "@/lib/clinic";
import { PageHead } from "@/components/PageHead";
import { HoursAndMap } from "@/components/sections";
import { Icon } from "@/components/Icons";
import { AskMiraButton } from "@/components/bits";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).contact.title } : {};
}

export default async function Contact({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  const items = [
    { icon: <Icon.Phone size={20} />, label: d.contact.phone, value: CLINIC.phone, href: `tel:${CLINIC.phone.replace(/\s/g, "")}`, ltr: true },
    { icon: <Icon.Mail size={20} />, label: d.contact.email, value: CLINIC.email, href: `mailto:${CLINIC.email}`, ltr: true },
    { icon: <Icon.Pin size={20} />, label: d.contact.address, value: CLINIC.address[locale] },
  ];
  return (
    <>
      <PageHead title={d.contact.title} lead={d.contact.lead} />
      <section className="mx-auto max-w-6xl space-y-6 px-5 py-14">
        <div className="flex flex-col gap-4 rounded-3xl border border-coral/30 bg-coral/10 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">{d.contact.emergency}</p>
          <a href={`tel:${CLINIC.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 rounded-full bg-coral px-5 py-2.5 font-semibold text-white" dir="ltr">
            <Icon.Phone size={16} /> {CLINIC.phone}
          </a>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {items.map((it) => (
            <div key={it.label} className="rounded-3xl border border-line bg-surface p-6">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-brand-dark">{it.icon}</span>
              <p className="mt-4 text-sm text-muted">{it.label}</p>
              {it.href ? (
                <a href={it.href} className="mt-1 block font-semibold hover:text-brand" dir={it.ltr ? "ltr" : undefined}>
                  {it.value}
                </a>
              ) : (
                <p className="mt-1 font-semibold">{it.value}</p>
              )}
            </div>
          ))}
        </div>
        <HoursAndMap d={d} locale={locale} />
        <div className="flex justify-center pt-4">
          <AskMiraButton label={d.hero.ask} className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-semibold text-white" />
        </div>
      </section>
    </>
  );
}
