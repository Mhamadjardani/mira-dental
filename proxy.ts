import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["en", "ar", "fr"];

/** Sends "/" and un-prefixed paths to the visitor's language (English by default). */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  const header = request.headers.get("accept-language") ?? "";
  const preferred = header
    .split(",")
    .map((p) => p.split(";")[0].trim().slice(0, 2).toLowerCase())
    .find((l) => LOCALES.includes(l));
  request.nextUrl.pathname = `/${preferred ?? "en"}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!api|_next|icon|apple-icon|favicon|robots|sitemap|.*\\..*).*)"],
};
