import { cancelBooking, publicBooking } from "@/lib/bookings";
import { json, overLimit, readJson } from "@/lib/http";

export async function POST(req: Request) {
  if (await overLimit(req, "manage", 30)) return json({ error: "rate_limited" }, 429);
  const b = await readJson<Record<string, string>>(req);
  const r = await cancelBooking({ code: String(b?.code ?? ""), phone: String(b?.phone ?? "") });
  return r.ok ? json({ booking: publicBooking(r.value) }) : json({ error: r.error }, 400);
}
