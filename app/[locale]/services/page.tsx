import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import { SERVICES } from "@/lib/clinic";
import { PageHead } from "@/components/PageHead";
import { CtaBand, ServiceCard } from "@/components/sections";

export async function generateMetadata({ params }: PageProps<"/[locale]/services">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).services.title, description: getDict(locale).services.lead } : {};
}

export default async function Services({ params }: PageProps<"/[locale]/services">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  return (
    <>
      <PageHead title={d.services.title} lead={d.services.lead} />
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <ServiceCard key={s.id} s={s} d={d} locale={locale} i={i} />
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5">
        <CtaBand d={d} locale={locale} />
      </section>
    </>
  );
}
