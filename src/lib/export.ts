import type { Meeting, ActionItem } from "@/generated/prisma/client";

export function generateTextExport(
  meeting: Meeting & { actionItems: ActionItem[] }
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
      txt += `${check} ${item.content}${assignee}\n`;
    }
    txt += "\n";
  }

  if (meeting.transcript) {
    txt += `TRANSCRIPT\n----------\n${meeting.transcript}\n`;
  }

  return txt;
}
