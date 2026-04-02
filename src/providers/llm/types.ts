export interface LLMResponse {
  content: string;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly requiresApiKey: boolean;

  complete(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<LLMResponse>;
}

export interface LLMProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}
