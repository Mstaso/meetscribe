import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { processMeeting } from "@/lib/pipeline";
import { unlink } from "fs/promises";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/meetings/[id]">
) {
  const { id } = await context.params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    include: { actionItems: true, decisions: true, openQuestions: true },
  });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  return NextResponse.json(meeting);
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/meetings/[id]">
) {
  const { id } = await context.params;
  const body = await request.json();

  // Toggle action item completion
  if (body.actionItemId && typeof body.completed === "boolean") {
    const actionItem = await db.actionItem.update({
      where: { id: body.actionItemId },
      data: { completed: body.completed },
    });
    return NextResponse.json(actionItem);
  }

  // Retry processing
  if (body.retry === true) {
    await db.$transaction([
      db.meeting.update({
        where: { id },
        data: { status: "uploaded", errorMessage: null, summary: null },
      }),
      db.actionItem.deleteMany({ where: { meetingId: id } }),
      db.decision.deleteMany({ where: { meetingId: id } }),
      db.openQuestion.deleteMany({ where: { meetingId: id } }),
    ]);
    processMeeting(id).catch(console.error);
    return NextResponse.json({ status: "retrying" });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/meetings/[id]">
) {
  const { id } = await context.params;
  const meeting = await db.meeting.findUnique({ where: { id } });

  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  // Delete the uploaded file
  try {
    await unlink(meeting.fileUrl);
  } catch {
    // File may already be gone
  }

  await db.meeting.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
