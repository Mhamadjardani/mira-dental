import { handleChat } from "@/lib/agent/chat";
import { clientIp, json, readJson } from "@/lib/http";
import { isLocale } from "@/lib/i18n";

export const maxDuration = 30;

export async function POST(req: Request) {
  const b = await readJson<{ sessionId?: string; locale?: string; text?: string }>(req);
  const sessionId = String(b?.sessionId ?? "");
  const text = String(b?.text ?? "").trim();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(sessionId) || !text) return json({ error: "bad_request" }, 400);
  const locale = b?.locale && isLocale(b.locale) ? b.locale : "en";
  const res = await handleChat({ sessionId, locale, text, ip: clientIp(req) });
  return json(res);
}
