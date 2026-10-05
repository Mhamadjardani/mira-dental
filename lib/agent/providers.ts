import "server-only";
import type { AgentMessage, ModelProvider, ModelReply, ToolCall, ToolSpec } from "./types";

/* Two adapters cover the free options:
   - Gemini (Google AI Studio key)
   - Any OpenAI-compatible chat API: Groq, OpenRouter, a local Ollama, …
   Pick with AI_PROVIDER, or let it auto-detect from the keys that are set. */

/** Per model call. A slow model is treated like a failed one so the next can answer in time. */
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 12_000;

async function postJson(url: string, body: unknown, headers: Record<string, string>) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new ProviderError(timedOut ? 504 : 502, timedOut ? `timed out after ${TIMEOUT_MS}ms` : String(e));
  }
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

/** Gemini 3+ thinks at "high" by default, which is slow for a receptionist: keep it low
 *  (and leave temperature at its default, as Google recommends). 2.x: thinking off. */
export function geminiConfig(model: string) {
  const major = Number(/gemini-(\d+)/.exec(model)?.[1] ?? 0);
  return major >= 3 ? { thinkingConfig: { thinkingLevel: "low" } } : { temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } };
}

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
        generationConfig: geminiConfig(this.model),
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

const GROQ_URL = "https://api.groq.com/openai/v1";
/** Free-tier model names change; each provider gets a short list to try in order.
 *  Override with a comma-separated GEMINI_MODEL / GROQ_MODEL. */
const DEFAULT_GEMINI_MODELS = ["gemini-3.5-flash", "gemini-2.5-flash"];
const DEFAULT_GROQ_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"];

const list = (v: string | undefined, fallback: string[]) => {
  const items = (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return items.length ? items : fallback;
};

function geminiChain(env: NodeJS.ProcessEnv): ModelProvider[] {
  if (!env.GEMINI_API_KEY) return [];
  return list(env.GEMINI_MODEL, DEFAULT_GEMINI_MODELS).map((m) => new GeminiProvider(env.GEMINI_API_KEY!, m));
}
function groqChain(env: NodeJS.ProcessEnv): ModelProvider[] {
  if (!env.GROQ_API_KEY) return [];
  return list(env.GROQ_MODEL, DEFAULT_GROQ_MODELS).map((m) => new OpenAICompatibleProvider(GROQ_URL, env.GROQ_API_KEY!, m, "groq"));
}
function compatChain(env: NodeJS.ProcessEnv): ModelProvider[] {
  if (!env.OPENAI_COMPAT_BASE_URL || !env.OPENAI_COMPAT_MODEL) return [];
  return [new OpenAICompatibleProvider(env.OPENAI_COMPAT_BASE_URL, env.OPENAI_COMPAT_API_KEY ?? "none", env.OPENAI_COMPAT_MODEL)];
}

/** The single preferred provider (first model of the chosen/auto-detected provider). */
export function getProvider(env: NodeJS.ProcessEnv = process.env): ModelProvider | null {
  return orderedChain(env)[0] ?? null;
}

function orderedChain(env: NodeJS.ProcessEnv): ModelProvider[] {
  const choice = (env.AI_PROVIDER ?? "").toLowerCase();
  if (choice === "gemini") return geminiChain(env);
  if (choice === "groq") return groqChain(env);
  if (choice === "openai-compatible") return compatChain(env);
  return [...geminiChain(env), ...groqChain(env), ...compatChain(env)];
}

/** Tries each provider/model in turn. Free tiers fail in many ways (429 quota,
 *  403 access, 404 renamed model, 5xx), and any of them should hand over to the next. */
const COOLDOWN_MS = 60_000;
const failedAt = new Map<string, number>();

export class FallbackProvider implements ModelProvider {
  readonly name: string;
  constructor(private providers: ModelProvider[]) {
    this.name = providers.map((p) => p.name).join(" → ");
  }
  async complete(input: Parameters<ModelProvider["complete"]>[0]) {
    let last: unknown;
    // Models that failed in the last minute go to the back of the queue instead of costing time again.
    const now = Date.now();
    const fresh = (p: ModelProvider) => now - (failedAt.get(p.name) ?? 0) > COOLDOWN_MS;
    const order = [...this.providers.filter(fresh), ...this.providers.filter((p) => !fresh(p))];
    for (const p of order) {
      try {
        const reply = await p.complete(input);
        failedAt.delete(p.name);
        return reply;
      } catch (e) {
        last = e;
        failedAt.set(p.name, Date.now());
        console.warn(`[ai] ${p.name} failed:`, e instanceof ProviderError ? `${e.status} ${e.body.slice(0, 300)}` : e);
      }
    }
    throw last;
  }
}

export function getProviderChain(env: NodeJS.ProcessEnv = process.env): ModelProvider | null {
  const chain = orderedChain(env);
  if (!chain.length) return null;
  return chain.length === 1 ? chain[0] : new FallbackProvider(chain);
}
