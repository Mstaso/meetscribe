import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { generateTextExport } from "@/lib/export";

export async function GET(
  request: Request,
  context: RouteContext<"/api/meetings/[id]/export">
) {
  const { id } = await context.params;

  const meeting = await db.meeting.findUnique({
    where: { id },
    include: { actionItems: true, decisions: true, openQuestions: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const text = generateTextExport(meeting);
  const safeTitle = meeting.title.replace(/[^a-zA-Z0-9_-]/g, "_");
  return new Response(text, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}_notes.txt"`,
    },
  });
}
