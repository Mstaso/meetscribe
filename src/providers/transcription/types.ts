export interface TranscriptionResult {
  text: string;
  duration?: number; // seconds
}

export interface TranscriptionProvider {
  readonly id: string;
  readonly name: string;
  readonly requiresApiKey: boolean;

  transcribe(
    filePath: string,
    options?: { model?: string; language?: string }
  ): Promise<TranscriptionResult>;
}

export interface TranscriptionProviderConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}
