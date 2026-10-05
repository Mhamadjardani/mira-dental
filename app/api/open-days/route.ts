import { findOpenDays } from "@/lib/bookings";
import { json } from "@/lib/http";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const r = await findOpenDays({
    serviceId: u.searchParams.get("service") ?? "",
    dentistId: u.searchParams.get("dentist") || undefined,
    days: 14,
  });
  return r.ok ? json({ days: r.value }) : json({ error: r.error }, 400);
}
