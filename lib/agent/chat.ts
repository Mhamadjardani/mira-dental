import "server-only";
import { getStore, type ChatTurn } from "../store";
import { clinicNow } from "../time";
import { runAgent, trimHistory } from "./agent";
import { getProviderChain, ProviderError } from "./providers";
import type { ToolEvent } from "./tools";
import type { AgentMessage, ModelProvider } from "./types";

const LIMITS = {
  perSession: Number(process.env.CHAT_LIMIT_PER_SESSION ?? 25),
  perIpPerDay: Number(process.env.CHAT_LIMIT_PER_IP_DAY ?? 60),
  perDay: Number(process.env.CHAT_LIMIT_PER_DAY ?? 400),
};

const TEXT = {
  offline: {
    en: "The live assistant is switched off on this copy of the site (no AI key is configured). You can still book with the form on the Book page.",
    ar: "المساعد الذكي غير مفعّل على هذه النسخة من الموقع. يمكنك الحجز عبر نموذج صفحة الحجز.",
    fr: "L'assistant n'est pas activé sur cette copie du site. Vous pouvez réserver via le formulaire de la page Rendez-vous.",
  },
  limited: {
    en: "This demo has reached its message limit for now. Please use the booking form, or try again later.",
    ar: "وصل هذا العرض التجريبي إلى حدّ الرسائل حاليًا. يرجى استخدام نموذج الحجز أو المحاولة لاحقًا.",
    fr: "Cette démo a atteint sa limite de messages pour le moment. Utilisez le formulaire de réservation ou réessayez plus tard.",
  },
  error: {
    en: "Sorry, I'm having trouble right now. Please try again in a moment, or use the booking form.",
    ar: "عذرًا، هناك مشكلة مؤقتة. حاول مجددًا بعد قليل أو استخدم نموذج الحجز.",
    fr: "Désolée, un problème temporaire est survenu. Réessayez dans un instant ou utilisez le formulaire.",
  },
};
type Loc = keyof typeof TEXT.offline;
const t = (k: keyof typeof TEXT, locale: string) => TEXT[k][(locale in TEXT[k] ? locale : "en") as Loc];

export type ChatResponse = {
  reply: string;
  events: ToolEvent[];
  status: "ok" | "offline" | "limited" | "error";
  remaining?: number;
};

export async function handleChat(
  input: { sessionId: string; locale: string; text: string; ip?: string },
  provider: ModelProvider | null = getProviderChain(),
): Promise<ChatResponse> {
  const text = input.text.trim().slice(0, 600);
  if (!provider) return { reply: t("offline", input.locale), events: [], status: "offline" };

  const store = getStore();
  const day = clinicNow().date;
  const [sessionCount, ipCount, dayCount] = await Promise.all([
    store.bump(`s:${input.sessionId}`),
    store.bump(`ip:${input.ip ?? "?"}:${day}`),
    store.bump(`day:${day}`),
  ]);
  if (sessionCount > LIMITS.perSession || ipCount > LIMITS.perIpPerDay || dayCount > LIMITS.perDay) {
    return { reply: t("limited", input.locale), events: [], status: "limited", remaining: 0 };
  }

  const convo = (await store.getConversation(input.sessionId)) ?? {
    sessionId: input.sessionId,
    locale: input.locale,
    turns: [] as ChatTurn[],
    messages: [],
    updatedAt: new Date().toISOString(),
  };
  const now = () => new Date().toISOString();
  convo.turns.push({ role: "user", text, at: now() });

  try {
    const result = await runAgent({
      provider,
      locale: input.locale,
      history: trimHistory(convo.messages as AgentMessage[]),
      userText: text,
    });
    for (const m of result.messages.slice(-(result.toolLog.length * 2 + 2))) {
      if (m.role === "tool") convo.turns.push({ role: "tool", tool: m.name, text: summarise(m.result), at: now() });
    }
    convo.turns.push({ role: "assistant", text: result.reply, at: now() });
    convo.messages = trimHistory(result.messages, 40);
    convo.locale = input.locale;
    await store.saveConversation(convo);
    return { reply: result.reply, events: result.events, status: "ok", remaining: Math.max(0, LIMITS.perSession - sessionCount) };
  } catch (e) {
    console.error("[chat]", e instanceof ProviderError ? `${e.status} ${e.body}` : e);
    convo.turns.push({ role: "assistant", text: "(error)", at: now() });
    await store.saveConversation(convo);
    return { reply: t("error", input.locale), events: [], status: "error" };
  }
}

function summarise(result: unknown): string {
  const r = result as { ok?: boolean; error?: string; booking?: { code: string }; total_free?: number; days?: unknown[] };
  if (r?.ok === false) return `error: ${r.error}`;
  if (r?.booking) return `booking ${r.booking.code}`;
  if (typeof r?.total_free === "number") return `${r.total_free} free times`;
  if (Array.isArray(r?.days)) return `${r.days.length} open days`;
  return "ok";
}
