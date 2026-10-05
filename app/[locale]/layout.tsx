import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import "../globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatWidget } from "@/components/ChatWidget";
import { MotionProvider } from "@/components/Reveal";
import { LOCALES, dirOf, getDict, isLocale } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const d = getDict(locale);
  return {
    title: { default: d.meta.title, template: `%s · Mira Dental Studio` },
    description: d.meta.description,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) },
    openGraph: { title: d.meta.title, description: d.meta.description, type: "website", locale },
  };
}

export const viewport: Viewport = { themeColor: "#0f766e" };

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  return (
    <html lang={locale} dir={dirOf(locale)}>
      <body className="min-h-screen font-sans antialiased">
        <MotionProvider>
          <Header locale={locale} nav={d.nav} />
          <main>{children}</main>
          <Footer locale={locale} d={d} />
          <ChatWidget locale={locale} t={d.chat} />
        </MotionProvider>
      </body>
    </html>
  );
}
