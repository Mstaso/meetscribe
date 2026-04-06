import { db } from "@/server/db";
import {
  getActiveLLMProvider,
  getActiveTranscriptionProvider,
} from "@/providers/get-active-providers";
import {
  SUMMARY_SYSTEM_PROMPT,
  ACTION_ITEMS_SYSTEM_PROMPT,
  DECISIONS_SYSTEM_PROMPT,
  OPEN_QUESTIONS_SYSTEM_PROMPT,
} from "./prompts";
import { parseActionItems } from "./parse-action-items";
import { parseDecisions } from "./parse-decisions";
import { parseOpenQuestions } from "./parse-open-questions";
import type { LLMProvider } from "@/providers/llm/types";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Call the LLM with retries. Weaker models and self-hosted instances
 * can be flaky — transient failures, timeouts, rate limits.
 */
async function llmWithRetry(
  provider: LLMProvider,
  systemPrompt: string,
  userPrompt: string,
  attempt = 0
): Promise<string> {
  try {
    const result = await provider.complete(systemPrompt, userPrompt);
    return result.content;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      return llmWithRetry(provider, systemPrompt, userPrompt, attempt + 1);
    }
    throw error;
  }
}

/**
 * Truncate transcript if it's too long for weaker models.
 * Many models have small context windows or degrade with long inputs.
 */
function prepareTranscript(text: string, maxChars = 50000): string {
  if (text.length <= maxChars) return text;

  const truncated = text.slice(0, maxChars);
  // Cut at last sentence boundary to avoid mid-word truncation
  const lastPeriod = truncated.lastIndexOf(".");
  const cutPoint = lastPeriod > maxChars * 0.8 ? lastPeriod + 1 : maxChars;

  return truncated.slice(0, cutPoint) + "\n\n[Transcript truncated due to length]";
}

export async function processMeeting(meetingId: string) {
  try {
    // Step 1: Transcribe
    await db.meeting.update({
      where: { id: meetingId },
      data: { status: "transcribing" },
    });

    const transcriptionProvider = await getActiveTranscriptionProvider();
    const meeting = await db.meeting.findUniqueOrThrow({
      where: { id: meetingId },
    });

    const result = await transcriptionProvider.transcribe(meeting.fileUrl);

    await db.meeting.update({
      where: { id: meetingId },
      data: { transcript: result.text, duration: result.duration },
    });

    // Step 2: Summarize and extract
    await db.meeting.update({
      where: { id: meetingId },
      data: { status: "summarizing" },
    });

    const llmProvider = await getActiveLLMProvider();
    const transcript = prepareTranscript(result.text);

    // Run all LLM calls sequentially for weaker models
    // (parallel requests can overwhelm local models like Ollama)
    const summaryText = await llmWithRetry(
      llmProvider,
      SUMMARY_SYSTEM_PROMPT,
      transcript
    );

    const actionsText = await llmWithRetry(
      llmProvider,
      ACTION_ITEMS_SYSTEM_PROMPT,
      transcript
    );

    const decisionsText = await llmWithRetry(
      llmProvider,
      DECISIONS_SYSTEM_PROMPT,
      transcript
    );

    const openQuestionsText = await llmWithRetry(
      llmProvider,
      OPEN_QUESTIONS_SYSTEM_PROMPT,
      transcript
    );

    // Robust parsing that handles all kinds of messy LLM output
    const actionItems = parseActionItems(actionsText);
    const decisions = parseDecisions(decisionsText);
    const openQuestions = parseOpenQuestions(openQuestionsText);

    // Step 3: Store results
    await db.$transaction([
      db.meeting.update({
        where: { id: meetingId },
        data: { summary: summaryText, status: "complete" },
      }),
      ...actionItems.map((item) =>
        db.actionItem.create({
          data: {
            content: item.content,
            assignee: item.assignee ?? null,
            priority: item.priority ?? null,
            dueDate: item.dueDate ?? null,
            meetingId,
          },
        })
      ),
      ...decisions.map((item) =>
        db.decision.create({
          data: {
            content: item.content,
            rationale: item.rationale ?? null,
            decisionMakers: item.decisionMakers ?? null,
            meetingId,
          },
        })
      ),
      ...openQuestions.map((item) =>
        db.openQuestion.create({
          data: {
            question: item.question,
            context: item.context ?? null,
            owner: item.owner ?? null,
            meetingId,
          },
        })
      ),
    ]);
  } catch (error) {
    await db.meeting.update({
      where: { id: meetingId },
      data: {
        status: "error",
        errorMessage:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    });
  }
}
