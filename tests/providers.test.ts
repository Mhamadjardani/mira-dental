import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider, OpenAICompatibleProvider, getProvider } from "@/lib/agent/providers";
import type { ToolSpec } from "@/lib/agent/types";

const tools: ToolSpec[] = [
  { name: "find_available_times", description: "d", parameters: { type: "object", properties: { date: { type: "string", description: "x" } }, required: ["date"] } },
];

function mockFetch(response: unknown) {
  const fn = vi.fn(async (_url: string, init: RequestInit) => ({ ok: true, status: 200, text: async () => JSON.stringify(response), init }));
  vi.stubGlobal("fetch", fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

describe("GeminiProvider", () => {
  it("sends tools, parses function calls and replays raw parts", async () => {
    const parts = [{ functionCall: { name: "find_available_times", args: { date: "2026-10-06" } }, thoughtSignature: "sig" }];
    const fetch = mockFetch({ candidates: [{ content: { parts } }] });
    const p = new GeminiProvider("k", "gemini-test");
    const reply = await p.complete({ system: "s", messages: [{ role: "user", text: "hi" }], tools });
    expect(reply.calls?.[0]).toMatchObject({ name: "find_available_times", args: { date: "2026-10-06" } });

    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body.tools[0].functionDeclarations[0].parameters.type).toBe("OBJECT");
    expect(fetch.mock.calls[0][0]).toContain("models/gemini-test:generateContent");

    // Second turn: the model's raw parts (with thoughtSignature) must be sent back unchanged.
    mockFetch({ candidates: [{ content: { parts: [{ text: "Here you go" }] } }] });
    const f2 = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>);
    await p.complete({
      system: "s",
      messages: [
        { role: "user", text: "hi" },
        { role: "assistant", calls: reply.calls, raw: reply.raw },
        { role: "tool", callId: reply.calls![0].id, name: "find_available_times", result: { ok: true } },
      ],
      tools,
    });
    const body2 = JSON.parse(f2.mock.calls[0][1].body as string);
    expect(body2.contents[1]).toEqual({ role: "model", parts });
    expect(body2.contents[2].parts[0].functionResponse.name).toBe("find_available_times");
  });
});

describe("OpenAICompatibleProvider", () => {
  it("maps tool calls both ways", async () => {
    const fetch = mockFetch({
      choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "find_available_times", arguments: '{"date":"2026-10-06"}' } }] } }],
    });
    const p = new OpenAICompatibleProvider("https://example.test/v1", "k", "m");
    const reply = await p.complete({ system: "s", messages: [{ role: "user", text: "hi" }], tools });
    expect(reply.calls).toEqual([{ id: "c1", name: "find_available_times", args: { date: "2026-10-06" } }]);
    const body = JSON.parse(fetch.mock.calls[0][1].body as string);
    expect(body.messages[0]).toEqual({ role: "system", content: "s" });
    expect(body.tools[0].type).toBe("function");
  });
});

describe("getProvider", () => {
  it("prefers Gemini, then Groq, and returns null without keys", () => {
    expect(getProvider({ GEMINI_API_KEY: "a", GROQ_API_KEY: "b" } as unknown as NodeJS.ProcessEnv)?.name).toMatch(/^gemini/);
    expect(getProvider({ GROQ_API_KEY: "b" } as unknown as NodeJS.ProcessEnv)?.name).toMatch(/^groq/);
    expect(getProvider({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});
