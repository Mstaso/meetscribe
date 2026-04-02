import type { Meeting, ActionItem } from "@/generated/prisma/client";

export function generateMarkdownExport(
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

  let md = `# ${meeting.title}\n\n`;
  md += `**Date:** ${date}  \n`;
  md += `**Duration:** ${duration}  \n`;
  md += `**Source file:** ${meeting.fileName}\n\n`;

  if (meeting.summary) {
    md += `## Summary\n\n${meeting.summary}\n\n`;
  }

  if (meeting.actionItems.length > 0) {
    md += `## Action Items\n\n`;
    for (const item of meeting.actionItems) {
      const checkbox = item.completed ? "[x]" : "[ ]";
      const assignee = item.assignee ? ` _(${item.assignee})_` : "";
      md += `- ${checkbox} ${item.content}${assignee}\n`;
    }
    md += "\n";
  }

  if (meeting.transcript) {
    md += `## Transcript\n\n${meeting.transcript}\n`;
  }

  return md;
}
