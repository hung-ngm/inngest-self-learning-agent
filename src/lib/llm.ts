/** LLM — wrapper around pi-ai's Models.complete(). */

import { validateToolArguments } from "@earendil-works/pi-ai";
import type { Tool, Message, AssistantMessage, TextContent, ToolCall } from "@earendil-works/pi-ai";
import { config } from "../config.ts";
import { complete, resolveModel } from "./models.ts";

export type { Tool, Message, AssistantMessage, TextContent, ToolCall };
export { validateToolArguments };

let _model: ReturnType<typeof resolveModel> | null = null;

export function getConfiguredModel() {
  if (!_model) {
    _model = resolveModel(config.llm.provider, config.llm.model, config.llm.openaiBaseUrl);
  }
  return _model;
}

export interface LLMResponse {
  message: AssistantMessage;
  text: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  usage: AssistantMessage["usage"];
  stopReason: AssistantMessage["stopReason"];
}

export async function callLLM(
  system: string,
  messages: Message[],
  tools: Tool[],
): Promise<LLMResponse> {
  const model = getConfiguredModel();

  const result = await complete(model, {
    systemPrompt: system,
    messages,
    tools,
  });

  const text = result.content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("");

  const toolCalls = result.content
    .filter((c): c is ToolCall => c.type === "toolCall")
    .map((c) => ({ id: c.id, name: c.name, arguments: c.arguments || {} }));

  return {
    message: result,
    text,
    toolCalls,
    usage: result.usage,
    stopReason: result.stopReason,
  };
}
