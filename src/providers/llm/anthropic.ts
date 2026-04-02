import type { LLMProvider, LLMProviderConfig, LLMResponse } from "./types";

export class AnthropicLLMProvider implements LLMProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic (Claude)";
  readonly requiresApiKey = true;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) throw new Error("Anthropic API key is required");
    this.apiKey = config.apiKey;
    this.model = config.model ?? "claude-sonnet-4-20250514";
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1";
  }

  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find(
      (block: { type: string }) => block.type === "text"
    );
    return { content: textBlock?.text ?? "" };
  }
}
