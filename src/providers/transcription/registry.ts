import type { TranscriptionProvider, TranscriptionProviderConfig } from "./types";
import { WhisperAPIProvider } from "./whisper-api";
import { WhisperCppProvider } from "./whisper-cpp";

type ProviderFactory = (config: TranscriptionProviderConfig) => TranscriptionProvider;

const registry = new Map<string, ProviderFactory>();

registry.set("whisper-api", (config) => new WhisperAPIProvider(config));
registry.set("whisper-cpp", (config) => new WhisperCppProvider(config));

export function getTranscriptionProvider(
  id: string,
  config: TranscriptionProviderConfig
): TranscriptionProvider {
  const factory = registry.get(id);
  if (!factory) throw new Error(`Unknown transcription provider: ${id}`);
  return factory(config);
}

export function getAvailableTranscriptionProviders() {
  return [
    {
      id: "whisper-cpp",
      name: "Whisper.cpp (Local)",
      requiresApiKey: false,
      defaultModel: "base",
    },
    {
      id: "whisper-api",
      name: "OpenAI Whisper (Cloud)",
      requiresApiKey: true,
      defaultModel: "whisper-1",
    },
  ];
}
