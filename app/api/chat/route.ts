import { handleChat } from "@/lib/agent/chat";
import { clientIp, json, readJson } from "@/lib/http";
import { isLocale } from "@/lib/i18n";

export const maxDuration = 60;

export async function POST(req: Request) {
  const b = await readJson<{ sessionId?: string; locale?: string; text?: string; history?: unknown }>(req);
  const sessionId = String(b?.sessionId ?? "");
  const text = String(b?.text ?? "").trim();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(sessionId) || !text) return json({ error: "bad_request" }, 400);
  const locale = b?.locale && isLocale(b.locale) ? b.locale : "en";
  const res = await handleChat({ sessionId, locale, text, ip: clientIp(req), history: cleanHistory(b?.history) });
  return json(res);
}

/** Client-side transcript (text only). Never trusted for anything but context:
 *  every tool call re-checks availability and ownership on the server. */
function cleanHistory(raw: unknown): { role: "user" | "assistant"; text: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-12)
    .filter((m): m is { role: "user" | "assistant"; text: string } =>
      !!m && (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim().length > 0,
    )
    .map((m) => ({ role: m.role, text: m.text.slice(0, 800) }));
}
