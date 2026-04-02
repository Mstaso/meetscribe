import type { LLMProvider, LLMProviderConfig, LLMResponse } from "./types";

export class OllamaLLMProvider implements LLMProvider {
  readonly id = "ollama";
  readonly name = "Ollama (Local)";
  readonly requiresApiKey = false;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMProviderConfig) {
    this.model = config.model ?? "llama3";
    this.baseUrl = config.baseUrl ?? "http://localhost:11434";
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    // Try /api/generate first (most compatible, works with older Ollama
    // and company-hosted endpoints), fall back to /api/chat
    const generateResult = await this.tryGenerate(systemPrompt, userPrompt, options);
    if (generateResult !== null) return generateResult;

    return this.tryChat(systemPrompt, userPrompt, options);
  }

  private async tryGenerate(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse | null> {
    // Strip trailing slash and any existing /api/generate path to avoid duplication
    const base = this.baseUrl.replace(/\/+$/, "").replace(/\/api\/generate$/, "");

    try {
      const response = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.3,
            num_predict: options?.maxTokens ?? 2000,
          },
        }),
      });

      if (response.status === 404) return null; // endpoint doesn't exist, try /api/chat
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${error}`);
      }

      const data = await response.json();
      return { content: data.response ?? "" };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error(
          `Could not connect to Ollama at ${base}. Make sure Ollama is running.`
        );
      }
      if (error instanceof Error && error.message.includes("Ollama API error")) {
        throw error;
      }
      return null; // try chat fallback
    }
  }

  private async tryChat(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const base = this.baseUrl.replace(/\/+$/, "").replace(/\/api\/generate$/, "");

    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.3,
          num_predict: options?.maxTokens ?? 2000,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return { content: data.message?.content ?? "" };
  }
}
