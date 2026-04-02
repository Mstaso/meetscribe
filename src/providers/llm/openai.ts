import type { LLMProvider, LLMProviderConfig, LLMResponse } from "./types";

export class OpenAILLMProvider implements LLMProvider {
  readonly id = "openai";
  readonly name = "OpenAI";
  readonly requiresApiKey = true;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMProviderConfig) {
    // API key is required for OpenAI's API, but optional for
    // self-hosted/company endpoints that use the same format
    if (!config.apiKey && !config.baseUrl) {
      throw new Error("OpenAI API key is required (or set a custom Base URL for keyless endpoints)");
    }
    this.apiKey = config.apiKey ?? "";
    this.model = config.model ?? "gpt-oss";
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return { content: data.choices[0]?.message?.content ?? "" };
  }
}
