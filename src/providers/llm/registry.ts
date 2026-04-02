import type { LLMProvider, LLMProviderConfig } from "./types";
import { OpenAILLMProvider } from "./openai";
import { AnthropicLLMProvider } from "./anthropic";
import { OllamaLLMProvider } from "./ollama";

type ProviderFactory = (config: LLMProviderConfig) => LLMProvider;

const registry = new Map<string, ProviderFactory>();

registry.set("openai", (config) => new OpenAILLMProvider(config));
registry.set("anthropic", (config) => new AnthropicLLMProvider(config));
registry.set("ollama", (config) => new OllamaLLMProvider(config));

export function getLLMProvider(
  id: string,
  config: LLMProviderConfig
): LLMProvider {
  const factory = registry.get(id);
  if (!factory) throw new Error(`Unknown LLM provider: ${id}`);
  return factory(config);
}

export function getAvailableLLMProviders() {
  return [
    {
      id: "openai",
      name: "OpenAI",
      requiresApiKey: true,
      defaultModel: "gpt-oss",
    },
    {
      id: "anthropic",
      name: "Anthropic (Claude)",
      requiresApiKey: true,
      defaultModel: "claude-sonnet-4-20250514",
    },
    {
      id: "ollama",
      name: "Ollama (Local)",
      requiresApiKey: false,
      defaultModel: "llama3",
    },
  ];
}
