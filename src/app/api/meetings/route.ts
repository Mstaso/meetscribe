import { NextResponse } from "next/server";
import { db } from "@/server/db";

export async function GET() {
  const meetings = await db.meeting.findMany({
    orderBy: { createdAt: "desc" },
    include: { actionItems: true },
  });
  return NextResponse.json(meetings);
}
