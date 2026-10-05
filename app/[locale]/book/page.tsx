import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ERROR_TEXT, getDict, isLocale } from "@/lib/i18n";
import { DENTISTS, SERVICES } from "@/lib/clinic";
import { PageHead } from "@/components/PageHead";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { price } from "@/components/sections";

export async function generateMetadata({ params }: PageProps<"/[locale]/book">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).book.title, description: getDict(locale).book.lead } : {};
}

export default async function Book({ params, searchParams }: PageProps<"/[locale]/book">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const d = getDict(locale);
  return (
    <>
      <PageHead title={d.book.title} lead={d.book.lead} />
      <section className="mx-auto max-w-6xl px-5 py-12">
        <BookingWizard
          locale={locale}
          t={d.book}
          minutes={d.services.minutes}
          services={SERVICES.map((s) => ({ id: s.id, name: s.name[locale], duration: s.duration, price: price(s, d), icon: s.icon }))}
          dentists={DENTISTS.map((x) => ({ id: x.id, name: x.name, role: x.role[locale], initials: x.initials, hue: x.hue, services: x.services }))}
          errors={{ ...ERROR_TEXT[locale], generic: d.errors.generic }}
          initialService={typeof sp.service === "string" ? sp.service : undefined}
          initialDentist={typeof sp.dentist === "string" ? sp.dentist : undefined}
        />
      </section>
    </>
  );
}
