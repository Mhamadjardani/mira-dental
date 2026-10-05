import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setStore } from "@/lib/store";
import { handleChat } from "@/lib/agent/chat";
import { addDays, clinicNow, weekdayOf } from "@/lib/time";
import type { AgentMessage, ModelProvider, ModelReply, ToolSpec } from "@/lib/agent/types";

/** Next Tuesday (Léa works, clinic open all day), so tests never depend on the current time. */
function nextTuesday() {
  let d = addDays(clinicNow().date, 1);
  while (weekdayOf(d) !== 2) d = addDays(d, 1);
  return d;
}

/** A fake model: each step receives the conversation and decides what to do. */
function scripted(steps: ((msgs: AgentMessage[]) => ModelReply)[]): ModelProvider & { seen: AgentMessage[][]; tools: ToolSpec[] } {
  let i = 0;
  const p = {
    name: "scripted",
    seen: [] as AgentMessage[][],
    tools: [] as ToolSpec[],
    async complete({ messages, tools }: { system: string; messages: AgentMessage[]; tools: ToolSpec[] }) {
      p.seen.push([...messages]);
      p.tools = tools;
      const step = steps[Math.min(i++, steps.length - 1)];
      return step(messages);
    },
  };
  return p;
}

const lastTool = (msgs: AgentMessage[]) => [...msgs].reverse().find((m) => m.role === "tool") as Extract<AgentMessage, { role: "tool" }>;

beforeEach(() => setStore(new MemoryStore()));

describe("AI receptionist", () => {
  it("looks up real times, then books one of them", async () => {
    const date = nextTuesday();
    const provider = scripted([
      () => ({ calls: [{ id: "1", name: "find_available_times", args: { service_id: "whitening", date } }] }),
      (msgs) => {
        const r = lastTool(msgs).result as { ok: boolean; times: { time: string }[] };
        expect(r.ok).toBe(true);
        return {
          calls: [
            {
              id: "2",
              name: "book_appointment",
              args: { service_id: "whitening", date, time: r.times[0].time, patient_name: "Nour Khalil", phone: "+961 3 123 456" },
            },
          ],
        };
      },
      (msgs) => {
        const r = lastTool(msgs).result as { ok: boolean; booking: { code: string } };
        return { text: `Booked! Your code is ${r.booking.code}.` };
      },
    ]);

    const res = await handleChat({ sessionId: "s1", locale: "en", text: "Whitening next Tuesday please, Nour Khalil, 03 123 456" }, provider);
    expect(res.status).toBe("ok");
    expect(res.events).toHaveLength(1);
    expect(res.events[0].type).toBe("booked");
    expect(res.reply).toContain(res.events[0].booking.code);
    expect(provider.tools.map((t) => t.name)).toContain("book_appointment");
  });

  it("returns rule errors to the model instead of booking", async () => {
    const date = nextTuesday();
    const provider = scripted([
      () => ({
        calls: [{ id: "1", name: "book_appointment", args: { service_id: "checkup", date, time: "07:00", patient_name: "A B", phone: "+96170000000" } }],
      }),
      (msgs) => {
        expect(lastTool(msgs).result).toMatchObject({ ok: false, error: "outside_hours" });
        return { text: "We open at 9:00. Would 9:00 work?" };
      },
    ]);
    const res = await handleChat({ sessionId: "s2", locale: "en", text: "7am checkup" }, provider);
    expect(res.events).toHaveLength(0);
    expect(res.reply).toContain("9:00");
  });

  it("rejects malformed tool arguments safely", async () => {
    const provider = scripted([
      () => ({ calls: [{ id: "1", name: "cancel_appointment", args: { code: 42 } }] }),
      (msgs) => {
        expect(lastTool(msgs).result).toMatchObject({ ok: false, error: "invalid_arguments" });
        return { text: "Could you share your booking code and phone number?" };
      },
    ]);
    const res = await handleChat({ sessionId: "s3", locale: "en", text: "cancel" }, provider);
    expect(res.status).toBe("ok");
  });

  it("keeps conversation context between messages", async () => {
    const provider = scripted([() => ({ text: "Hello!" }), () => ({ text: "Still here." })]);
    await handleChat({ sessionId: "s4", locale: "fr", text: "Bonjour" }, provider);
    await handleChat({ sessionId: "s4", locale: "fr", text: "Merci" }, provider);
    const second = provider.seen[1];
    expect(second.filter((m) => m.role === "user").map((m) => (m as { text: string }).text)).toEqual(["Bonjour", "Merci"]);
  });

  it("stops after the per-session limit", async () => {
    process.env.CHAT_LIMIT_PER_SESSION = "25";
    const provider = scripted([() => ({ text: "ok" })]);
    let last;
    for (let i = 0; i < 26; i++) last = await handleChat({ sessionId: "s5", locale: "en", text: "hi", ip: "1.1.1.1" }, provider);
    expect(last!.status).toBe("limited");
  });

  it("explains when no AI key is configured", async () => {
    const res = await handleChat({ sessionId: "s6", locale: "ar", text: "مرحبا" }, null);
    expect(res.status).toBe("offline");
  });
});
