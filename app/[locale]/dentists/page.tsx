import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict, isLocale } from "@/lib/i18n";
import { DENTISTS } from "@/lib/clinic";
import { PageHead } from "@/components/PageHead";
import { CtaBand, DentistCard } from "@/components/sections";

export async function generateMetadata({ params }: PageProps<"/[locale]/dentists">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).team.title } : {};
}

export default async function Dentists({ params }: PageProps<"/[locale]/dentists">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  return (
    <>
      <PageHead title={d.team.title} lead={d.team.lead} />
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {DENTISTS.map((doc, i) => (
            <DentistCard key={doc.id} doc={doc} d={d} locale={locale} i={i} />
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5">
        <CtaBand d={d} locale={locale} />
      </section>
    </>
  );
}
