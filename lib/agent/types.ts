export type ToolCall = { id: string; name: string; args: Record<string, unknown> };

export type AgentMessage =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text?: string;
      calls?: ToolCall[];
      /** Provider-native turn, replayed as-is (Gemini needs its thought signatures back). */
      raw?: { provider: string; data: unknown };
    }
  | { role: "tool"; callId: string; name: string; result: unknown };

export type ToolSpec = {
  name: string;
  description: string;
  /** JSON Schema (object) for the arguments. */
  parameters: {
    type: "object";
    properties: Record<string, { type: "string" | "integer"; description: string; enum?: string[] }>;
    required?: string[];
  };
};

export type ModelReply = { text?: string; calls?: ToolCall[]; raw?: { provider: string; data: unknown } };

/** Any chat model that supports tool calling. */
export interface ModelProvider {
  readonly name: string;
  complete(input: { system: string; messages: AgentMessage[]; tools: ToolSpec[] }): Promise<ModelReply>;
}
