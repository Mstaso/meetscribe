import type { Meeting, ActionItem, Decision, OpenQuestion } from "@/generated/prisma/client";

export function generateTextExport(
  meeting: Meeting & { actionItems: ActionItem[]; decisions: Decision[]; openQuestions: OpenQuestion[] }
): string {
  const date = meeting.createdAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const duration = meeting.duration
    ? `${Math.floor(meeting.duration / 60)}m ${meeting.duration % 60}s`
    : "Unknown";

  let txt = `${meeting.title}\n`;
  txt += `${"=".repeat(meeting.title.length)}\n\n`;
  txt += `Date: ${date}\n`;
  txt += `Duration: ${duration}\n`;
  txt += `Source file: ${meeting.fileName}\n\n`;

  if (meeting.summary) {
    txt += `SUMMARY\n-------\n${meeting.summary}\n\n`;
  }

  if (meeting.actionItems.length > 0) {
    txt += `ACTION ITEMS\n------------\n`;
    for (const item of meeting.actionItems) {
      const check = item.completed ? "[x]" : "[ ]";
      const assignee = item.assignee ? ` (${item.assignee})` : "";
      const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : "";
      const dueDate = item.dueDate ? ` [Due: ${item.dueDate}]` : "";
      txt += `${check} ${item.content}${assignee}${priority}${dueDate}\n`;
    }
    txt += "\n";
  }

  if (meeting.decisions.length > 0) {
    txt += `KEY DECISIONS\n-------------\n`;
    for (const item of meeting.decisions) {
      const makers = item.decisionMakers ? ` (decided by: ${item.decisionMakers})` : "";
      txt += `- ${item.content}${makers}\n`;
      if (item.rationale) {
        txt += `  Rationale: ${item.rationale}\n`;
      }
    }
    txt += "\n";
  }

  if (meeting.openQuestions.length > 0) {
    txt += `OPEN QUESTIONS\n--------------\n`;
    for (const item of meeting.openQuestions) {
      const owner = item.owner ? ` (Owner: ${item.owner})` : "";
      txt += `- ${item.question}${owner}\n`;
      if (item.context) {
        txt += `  Context: ${item.context}\n`;
      }
    }
    txt += "\n";
  }

  if (meeting.transcript) {
    txt += `TRANSCRIPT\n----------\n${meeting.transcript}\n`;
  }

  return txt;
}
