import "server-only";
import { CLINIC } from "../clinic";
import { clinicNow, formatDate } from "../time";
import { runTool, TOOL_SPECS, type ToolEvent } from "./tools";
import type { AgentMessage, ModelProvider } from "./types";

const MAX_ROUNDS = 6;
/** Stay well inside the serverless time limit (maxDuration on /api/chat). */
const DEADLINE_MS = 42_000;
const LANG_NAME: Record<string, string> = { en: "English", ar: "Arabic", fr: "French" };

export function systemPrompt(locale: string, now = clinicNow()) {
  return `You are Mira, the friendly front-desk assistant of ${CLINIC.name}, a dental clinic in Beirut.

Today is ${formatDate(now.date, "en")} (${now.date}), and the time at the clinic is ${String(Math.floor(now.minutes / 60)).padStart(2, "0")}:${String(now.minutes % 60).padStart(2, "0")}.

What you do:
- Answer questions about services, prices, dentists, opening hours and location (use get_clinic_info).
- Book, reschedule and cancel appointments using the tools.

Rules:
- Never invent times, prices or availability. Only offer times returned by find_available_times.
- Turn relative dates ("tomorrow", "next Tuesday") into YYYY-MM-DD using today's date above.
- Before booking, collect the service, date, time, the patient's full name and phone number, then read the details back and wait for a clear yes.
- If a tool returns ok:false, explain the problem simply and offer the next best options.
- After booking, always give the booking code and say it is needed to change or cancel.
- You do not give medical advice or diagnoses. For severe pain, swelling, bleeding or trauma, tell them to call ${CLINIC.phone} or go to the nearest emergency room.
- Keep replies short (1–4 sentences), warm and clear. Offer at most 4 times at once.
- Write dates the way people say them, in the patient's language (e.g. "Thursday 8 October", "الخميس ٨ تشرين الأول", "jeudi 8 octobre"), never as YYYY-MM-DD. Use plain text; "- " bullets and **bold** are fine.
- Reply in the language the patient writes in. The website is currently shown in ${LANG_NAME[locale] ?? "English"}. Lebanese Arabic written in Latin letters (Arabizi) is fine: answer in the same style.
- This is a demo clinic for a developer's portfolio; if asked, say so honestly.`;
}

export type AgentResult = { reply: string; messages: AgentMessage[]; events: ToolEvent[]; toolLog: { name: string; ok: boolean }[] };

/** Runs the model ↔ tools loop until the model answers in plain text. */
export async function runAgent(input: {
  provider: ModelProvider;
  locale: string;
  history: AgentMessage[];
  userText: string;
}): Promise<AgentResult> {
  const messages: AgentMessage[] = [...input.history, { role: "user", text: input.userText }];
  const events: ToolEvent[] = [];
  const toolLog: { name: string; ok: boolean }[] = [];
  const system = systemPrompt(input.locale);

  const started = Date.now();
  for (let round = 0; round < MAX_ROUNDS && Date.now() - started < DEADLINE_MS; round++) {
    const reply = await input.provider.complete({ system, messages, tools: TOOL_SPECS });
    messages.push({ role: "assistant", text: reply.text, calls: reply.calls, raw: reply.raw });

    if (!reply.calls?.length) {
      return { reply: reply.text ?? "…", messages, events, toolLog };
    }
    for (const call of reply.calls) {
      const result = await runTool(call.name, call.args, events);
      toolLog.push({ name: call.name, ok: !!(result as { ok?: boolean })?.ok || call.name === "get_clinic_info" });
      messages.push({ role: "tool", callId: call.id, name: call.name, result });
    }
  }
  const fallback = "Sorry, I couldn't finish that. Could you rephrase, or call the clinic?";
  messages.push({ role: "assistant", text: fallback });
  return { reply: fallback, messages, events, toolLog };
}

/** Keeps recent context only, never splitting a tool call from its result. */
export function trimHistory(messages: AgentMessage[], maxMessages = 30): AgentMessage[] {
  if (messages.length <= maxMessages) return messages;
  let start = messages.length - maxMessages;
  while (start < messages.length && messages[start].role !== "user") start++;
  return messages.slice(start);
}
