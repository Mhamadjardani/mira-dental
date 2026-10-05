import { NextResponse } from "next/server";
import { adminCookie, adminPassword } from "@/lib/admin";
import { overLimit } from "@/lib/http";

export async function POST(req: Request) {
  const form = await req.formData();
  const locale = String(form.get("locale") ?? "en");
  const back = new URL(`/${locale}/admin`, req.url);
  if (await overLimit(req, "admin-login", 20)) return NextResponse.redirect(back, 303);
  if (String(form.get("password") ?? "") !== adminPassword()) {
    back.searchParams.set("error", "1");
    return NextResponse.redirect(back, 303);
  }
  const res = NextResponse.redirect(back, 303);
  res.cookies.set(adminCookie());
  return res;
}
