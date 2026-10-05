import { publicBooking, rescheduleBooking } from "@/lib/bookings";
import { getStore } from "@/lib/store";
import { normalizePhone } from "@/lib/bookings";
import { json, overLimit, readJson } from "@/lib/http";

/** With only code + phone: returns the booking (to show it). With date + start: moves it. */
export async function POST(req: Request) {
  if (await overLimit(req, "manage", 30)) return json({ error: "rate_limited" }, 429);
  const b = await readJson<Record<string, string>>(req);
  const code = String(b?.code ?? "").trim();
  const phone = String(b?.phone ?? "");
  if (!b?.date) {
    const found = await getStore().getBooking(code);
    if (!found) return json({ error: "not_found" }, 404);
    if (normalizePhone(found.phone).slice(-7) !== normalizePhone(phone).slice(-7)) return json({ error: "phone_mismatch" }, 400);
    return json({ booking: publicBooking(found) });
  }
  const r = await rescheduleBooking({ code, phone, date: String(b.date), start: String(b.start ?? ""), dentistId: b.dentistId || undefined });
  return r.ok ? json({ booking: publicBooking(r.value) }) : json({ error: r.error }, r.error === "slot_taken" ? 409 : 400);
}
