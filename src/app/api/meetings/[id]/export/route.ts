import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { generateMarkdownExport } from "@/lib/export";

export async function GET(
  request: Request,
  context: RouteContext<"/api/meetings/[id]/export">
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "md";

  const meeting = await db.meeting.findUnique({
    where: { id },
    include: { actionItems: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (format === "md") {
    const markdown = generateMarkdownExport(meeting);
    const safeTitle = meeting.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}_notes.md"`,
      },
    });
  }

  return NextResponse.json(
    { error: "Unsupported format. Use ?format=md" },
    { status: 400 }
  );
}
