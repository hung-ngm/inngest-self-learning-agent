/** Models — one shared pi-ai Models registry for the whole worker process. */

import { createProvider, envApiKeyAuth } from "@earendil-works/pi-ai";
import type { Api, AssistantMessage, Context, Model } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";

/**
 * Single stateful registry: built-in provider catalog + an in-memory credential
 * store seeded from process.env. Never construct a second one — providers
 * registered by resolveModel() would not be visible to it.
 */
export const models = builtinModels();

/** Note: pi-ai's google provider reads GEMINI_API_KEY, never GOOGLE_API_KEY. */
const API_KEY_ENV: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
};

function apiKeyFor(providerId: string): string | undefined {
  const envVar = API_KEY_ENV[providerId];
  return envVar ? process.env[envVar]?.trim() || undefined : undefined;
}

/**
 * Send a request with our own API key taking precedence.
 *
 * pi-ai resolves anthropic auth as ANTHROPIC_AUTH_TOKEN -> ANTHROPIC_OAUTH_TOKEN
 * -> ANTHROPIC_API_KEY, so an ambient token in the worker's shell would silently
 * outrank the key in .env. Passing `apiKey` explicitly short-circuits that chain.
 * When our env var is unset we pass undefined and pi-ai's normal resolution
 * applies, so OAuth setups keep working.
 *
 * Call this instead of models.complete() so no call site can forget the key.
 */
export function complete(model: Model<Api>, context: Context): Promise<AssistantMessage> {
  return models.complete(model, context, { apiKey: apiKeyFor(model.provider) });
}

const registeredCompatProviders = new Set<string>();

/**
 * Resolve a model for a provider/model pair.
 *
 * When `baseUrl` is set we hand-roll an openai-completions model AND register a
 * matching provider. The built-in `openai` provider speaks only the Responses
 * API, so routing a hand-rolled openai-completions model through it would
 * silently send Groq/Ollama/LiteLLM/vLLM traffic to the wrong wire format.
 */
export function resolveModel(providerId: string, modelId: string, baseUrl?: string): Model<Api> {
  if (baseUrl) {
    const model: Model<"openai-completions"> = {
      id: modelId,
      name: modelId,
      api: "openai-completions",
      provider: providerId,
      baseUrl,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128_000,
      maxTokens: 32_000,
    };

    if (!registeredCompatProviders.has(providerId)) {
      models.setProvider(
        createProvider({
          id: providerId,
          name: `${providerId} (OpenAI-compatible)`,
          baseUrl,
          auth: { apiKey: envApiKeyAuth("OpenAI-compatible API key", ["OPENAI_API_KEY"]) },
          models: [model],
          api: openAICompletionsApi(),
        }),
      );
      registeredCompatProviders.add(providerId);
    }

    return model;
  }

  const model = models.getModel(providerId, modelId);
  if (!model) {
    throw new Error(
      `Unknown model "${modelId}" for provider "${providerId}". ` +
        `Check AGENT_MODEL/LLM_PROVIDER (or SCORING_MODEL/SCORING_PROVIDER) env vars.`,
    );
  }
  return model;
}
