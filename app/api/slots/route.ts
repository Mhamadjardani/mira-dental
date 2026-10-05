import { findSlots } from "@/lib/bookings";
import { json } from "@/lib/http";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const r = await findSlots({
    serviceId: u.searchParams.get("service") ?? "",
    date: u.searchParams.get("date") ?? "",
    dentistId: u.searchParams.get("dentist") || undefined,
  });
  return r.ok ? json({ slots: r.value }) : json({ error: r.error }, 400);
}
