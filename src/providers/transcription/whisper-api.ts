import { readFile } from "fs/promises";
import { basename } from "path";
import type {
  TranscriptionProvider,
  TranscriptionProviderConfig,
  TranscriptionResult,
} from "./types";

export class WhisperAPIProvider implements TranscriptionProvider {
  readonly id = "whisper-api";
  readonly name = "OpenAI Whisper";
  readonly requiresApiKey = true;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(config: TranscriptionProviderConfig) {
    if (!config.apiKey) throw new Error("OpenAI API key is required for Whisper");
    this.apiKey = config.apiKey;
    this.model = config.model ?? "whisper-1";
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async transcribe(
    filePath: string,
    options?: { model?: string; language?: string }
  ): Promise<TranscriptionResult> {
    const fileBuffer = await readFile(filePath);
    const fileName = basename(filePath);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBuffer]),
      fileName
    );
    formData.append("model", options?.model ?? this.model);
    formData.append("response_format", "verbose_json");
    if (options?.language) {
      formData.append("language", options.language);
    }

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    return {
      text: data.text,
      duration: data.duration ? Math.round(data.duration) : undefined,
    };
  }
}
