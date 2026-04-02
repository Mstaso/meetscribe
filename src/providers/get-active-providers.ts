import { db } from "@/server/db";
import { getLLMProvider } from "./llm/registry";
import { getTranscriptionProvider } from "./transcription/registry";

export async function getActiveLLMProvider() {
  const settings = await db.providerSettings.findFirst({
    where: { id: "singleton" },
  });
  if (!settings) throw new Error("Provider settings not configured. Go to Settings to configure.");
  return getLLMProvider(settings.llmProvider, {
    apiKey: settings.llmApiKey ?? undefined,
    model: settings.llmModel ?? undefined,
    baseUrl: settings.llmBaseUrl ?? undefined,
  });
}

export async function getActiveTranscriptionProvider() {
  const settings = await db.providerSettings.findFirst({
    where: { id: "singleton" },
  });
  if (!settings) throw new Error("Provider settings not configured. Go to Settings to configure.");
  return getTranscriptionProvider(settings.transcriptionProvider, {
    apiKey: settings.transcriptionApiKey ?? undefined,
    model: settings.transcriptionModel ?? undefined,
    baseUrl: settings.transcriptionBaseUrl ?? undefined,
  });
}
