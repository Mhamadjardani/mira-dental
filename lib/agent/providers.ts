import "server-only";
import type { AgentMessage, ModelProvider, ModelReply, ToolCall, ToolSpec } from "./types";

/* Two adapters cover the free options:
   - Gemini (Google AI Studio key)
   - Any OpenAI-compatible chat API: Groq, OpenRouter, a local Ollama, …
   Pick with AI_PROVIDER, or let it auto-detect from the keys that are set. */

const TIMEOUT_MS = 25_000;

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new ProviderError(res.status, text.slice(0, 500));
  return JSON.parse(text);
}

export class ProviderError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Model provider error ${status}`);
  }
}

/* ------------------------------- Gemini ------------------------------- */

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown>; id?: string } }
  | { functionResponse: { name: string; response: Record<string, unknown>; id?: string } };

const geminiSchema = (p: ToolSpec["parameters"]) => ({
  type: "OBJECT",
  properties: Object.fromEntries(
    Object.entries(p.properties).map(([k, v]) => [
      k,
      { type: v.type.toUpperCase(), description: v.description, ...(v.enum ? { enum: v.enum } : {}) },
    ]),
  ),
  required: p.required ?? [],
});

export class GeminiProvider implements ModelProvider {
  readonly name: string;
  constructor(
    private apiKey: string,
    private model: string,
  ) {
    this.name = `gemini:${model}`;
  }

  async complete({ system, messages, tools }: { system: string; messages: AgentMessage[]; tools: ToolSpec[] }): Promise<ModelReply> {
    const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [];
    const push = (role: "user" | "model", part: GeminiPart) => {
      const last = contents.at(-1);
      if (last && last.role === role) last.parts.push(part);
      else contents.push({ role, parts: [part] });
    };
    for (const m of messages) {
      if (m.role === "user") push("user", { text: m.text });
      else if (m.role === "assistant") {
        if (m.raw?.provider === "gemini" && Array.isArray(m.raw.data)) {
          for (const part of m.raw.data as GeminiPart[]) push("model", part);
          continue;
        }
        if (m.text) push("model", { text: m.text });
        for (const c of m.calls ?? []) push("model", { functionCall: { name: c.name, args: c.args } });
      } else {
        push("user", { functionResponse: { name: m.name, response: { result: m.result } } });
      }
    }
    const data = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        systemInstruction: { parts: [{ text: system }] },
        contents,
        tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: geminiSchema(t.parameters) })) }],
        generationConfig: { temperature: 0.3 },
      },
      { "x-goog-api-key": this.apiKey },
    );
    const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p): p is { text: string } => "text" in p)
      .map((p) => p.text)
      .join("")
      .trim();
    const calls: ToolCall[] = parts
      .filter((p): p is Extract<GeminiPart, { functionCall: unknown }> => "functionCall" in p)
      .map((p, i) => ({ id: p.functionCall.id ?? `call_${Date.now()}_${i}`, name: p.functionCall.name, args: p.functionCall.args ?? {} }));
    return { text: text || undefined, calls: calls.length ? calls : undefined, raw: { provider: "gemini", data: parts } };
  }
}

/* ------------------------- OpenAI-compatible -------------------------- */

export class OpenAICompatibleProvider implements ModelProvider {
  readonly name: string;
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
    label = "openai-compatible",
  ) {
    this.name = `${label}:${model}`;
  }

  async complete({ system, messages, tools }: { system: string; messages: AgentMessage[]; tools: ToolSpec[] }): Promise<ModelReply> {
    const msgs: Record<string, unknown>[] = [{ role: "system", content: system }];
    for (const m of messages) {
      if (m.role === "user") msgs.push({ role: "user", content: m.text });
      else if (m.role === "assistant")
        msgs.push({
          role: "assistant",
          content: m.text ?? null,
          ...(m.calls?.length
            ? { tool_calls: m.calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })) }
            : {}),
        });
      else msgs.push({ role: "tool", tool_call_id: m.callId, content: JSON.stringify(m.result) });
    }
    const data = await postJson(
      `${this.baseUrl.replace(/\/$/, "")}/chat/completions`,
      {
        model: this.model,
        messages: msgs,
        tools: tools.map((t) => ({ type: "function", function: t })),
        tool_choice: "auto",
        temperature: 0.3,
      },
      { authorization: `Bearer ${this.apiKey}` },
    );
    const msg = data?.choices?.[0]?.message ?? {};
    const calls: ToolCall[] = (msg.tool_calls ?? []).map((c: { id: string; function: { name: string; arguments: string } }) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {
        args = {};
      }
      return { id: c.id, name: c.function.name, args };
    });
    const text = typeof msg.content === "string" ? msg.content.trim() : "";
    return { text: text || undefined, calls: calls.length ? calls : undefined };
  }
}

/* ------------------------------ Selection ----------------------------- */

export function getProvider(env: NodeJS.ProcessEnv = process.env): ModelProvider | null {
  const choice = (env.AI_PROVIDER ?? "").toLowerCase();
  const gemini = () =>
    env.GEMINI_API_KEY ? new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-3.5-flash") : null;
  const groq = () =>
    env.GROQ_API_KEY
      ? new OpenAICompatibleProvider("https://api.groq.com/openai/v1", env.GROQ_API_KEY, env.GROQ_MODEL || "llama-3.3-70b-versatile", "groq")
      : null;
  const compat = () =>
    env.OPENAI_COMPAT_BASE_URL && env.OPENAI_COMPAT_MODEL
      ? new OpenAICompatibleProvider(env.OPENAI_COMPAT_BASE_URL, env.OPENAI_COMPAT_API_KEY ?? "none", env.OPENAI_COMPAT_MODEL)
      : null;

  if (choice === "gemini") return gemini();
  if (choice === "groq") return groq();
  if (choice === "openai-compatible") return compat();
  return gemini() ?? groq() ?? compat();
}

/** Tries the primary provider, then the fallback if the first one is rate-limited, down,
 *  or refuses the model (403/404: free-tier access or model names change over time). */
export class FallbackProvider implements ModelProvider {
  readonly name: string;
  constructor(private providers: ModelProvider[]) {
    this.name = providers.map((p) => p.name).join(" → ");
  }
  async complete(input: Parameters<ModelProvider["complete"]>[0]) {
    let last: unknown;
    for (const p of this.providers) {
      try {
        return await p.complete(input);
      } catch (e) {
        last = e;
        const retryable = !(e instanceof ProviderError) || [403, 404, 429].includes(e.status) || e.status >= 500;
        if (!retryable) throw e;
      }
    }
    throw last;
  }
}

export function getProviderChain(env: NodeJS.ProcessEnv = process.env): ModelProvider | null {
  const primary = getProvider(env);
  if (!primary) return null;
  const extras: ModelProvider[] = [];
  if (env.GROQ_API_KEY && !primary.name.startsWith("groq"))
    extras.push(new OpenAICompatibleProvider("https://api.groq.com/openai/v1", env.GROQ_API_KEY, env.GROQ_MODEL || "llama-3.3-70b-versatile", "groq"));
  return extras.length ? new FallbackProvider([primary, ...extras]) : primary;
}
