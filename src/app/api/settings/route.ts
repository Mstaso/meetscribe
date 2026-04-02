import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { getAvailableLLMProviders } from "@/providers/llm/registry";
import { getAvailableTranscriptionProviders } from "@/providers/transcription/registry";

export async function GET() {
  let settings = await db.providerSettings.findFirst({
    where: { id: "singleton" },
  });

  // Auto-create default settings if none exist
  if (!settings) {
    settings = await db.providerSettings.create({
      data: { id: "singleton" },
    });
  }

  return NextResponse.json({
    settings: {
      transcriptionProvider: settings.transcriptionProvider,
      transcriptionApiKey: settings.transcriptionApiKey ? "••••••••" : null,
      transcriptionModel: settings.transcriptionModel,
      transcriptionBaseUrl: settings.transcriptionBaseUrl,
      llmProvider: settings.llmProvider,
      llmApiKey: settings.llmApiKey ? "••••••••" : null,
      llmModel: settings.llmModel,
      llmBaseUrl: settings.llmBaseUrl,
    },
    availableLLMProviders: getAvailableLLMProviders(),
    availableTranscriptionProviders: getAvailableTranscriptionProviders(),
  });
}

export async function PUT(request: Request) {
  const body = await request.json();

  const data: Record<string, string | null> = {};

  // Only update fields that are explicitly provided
  if (body.transcriptionProvider !== undefined)
    data.transcriptionProvider = body.transcriptionProvider;
  if (body.transcriptionApiKey !== undefined)
    data.transcriptionApiKey = body.transcriptionApiKey;
  if (body.transcriptionModel !== undefined)
    data.transcriptionModel = body.transcriptionModel || null;
  if (body.transcriptionBaseUrl !== undefined)
    data.transcriptionBaseUrl = body.transcriptionBaseUrl || null;
  if (body.llmProvider !== undefined)
    data.llmProvider = body.llmProvider;
  if (body.llmApiKey !== undefined)
    data.llmApiKey = body.llmApiKey;
  if (body.llmModel !== undefined)
    data.llmModel = body.llmModel || null;
  if (body.llmBaseUrl !== undefined)
    data.llmBaseUrl = body.llmBaseUrl || null;

  const settings = await db.providerSettings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return NextResponse.json({
    settings: {
      transcriptionProvider: settings.transcriptionProvider,
      transcriptionApiKey: settings.transcriptionApiKey ? "••••••••" : null,
      transcriptionModel: settings.transcriptionModel,
      transcriptionBaseUrl: settings.transcriptionBaseUrl,
      llmProvider: settings.llmProvider,
      llmApiKey: settings.llmApiKey ? "••••••••" : null,
      llmModel: settings.llmModel,
      llmBaseUrl: settings.llmBaseUrl,
    },
  });
}
