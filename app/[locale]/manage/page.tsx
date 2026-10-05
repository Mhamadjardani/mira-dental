import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ERROR_TEXT, getDict, isLocale } from "@/lib/i18n";
import { SERVICES } from "@/lib/clinic";
import { PageHead } from "@/components/PageHead";
import { ManageBooking } from "@/components/booking/ManageBooking";

export async function generateMetadata({ params }: PageProps<"/[locale]/manage">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).manage.title, robots: { index: false } } : {};
}

export default async function Manage({ params }: PageProps<"/[locale]/manage">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  return (
    <>
      <PageHead title={d.manage.title} lead={d.manage.lead} />
      <section className="px-5 py-12">
        <ManageBooking
          locale={locale}
          t={d.manage}
          book={d.book}
          errors={{ ...ERROR_TEXT[locale], generic: d.errors.generic }}
          serviceNames={Object.fromEntries(SERVICES.map((s) => [s.id, s.name[locale]]))}
        />
      </section>
    </>
  );
}
