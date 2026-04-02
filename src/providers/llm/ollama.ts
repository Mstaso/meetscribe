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
    const response = await fetch(`${this.baseUrl}/api/chat`, {
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
