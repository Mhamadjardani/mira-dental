import { createBooking, publicBooking } from "@/lib/bookings";
import { json, overLimit, readJson } from "@/lib/http";

export async function POST(req: Request) {
  if (await overLimit(req, "book", 20)) return json({ error: "rate_limited" }, 429);
  const b = await readJson<Record<string, string>>(req);
  if (!b) return json({ error: "bad_request" }, 400);
  const r = await createBooking({
    serviceId: String(b.serviceId ?? ""),
    date: String(b.date ?? ""),
    start: String(b.start ?? ""),
    dentistId: b.dentistId ? String(b.dentistId) : undefined,
    patientName: String(b.patientName ?? ""),
    phone: String(b.phone ?? ""),
    source: "website",
  });
  return r.ok ? json({ booking: publicBooking(r.value) }, 201) : json({ error: r.error }, r.error === "slot_taken" ? 409 : 400);
}
