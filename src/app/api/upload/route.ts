import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { db } from "@/server/db";
import { processMeeting } from "@/lib/pipeline";

const UPLOADS_DIR = join(process.cwd(), "uploads");
const ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 100MB limit" },
        { status: 400 }
      );
    }

    // Allow common audio/video types — also check by extension as a fallback
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["mp3", "wav", "webm", "ogg", "mp4", "m4a", "mov"];
    if (!ACCEPTED_TYPES.includes(file.type) && !validExts.includes(ext ?? "")) {
      return NextResponse.json(
        { error: "Unsupported file type. Accepted: mp3, wav, webm, ogg, mp4, m4a, mov" },
        { status: 400 }
      );
    }

    // Ensure uploads directory exists
    await mkdir(UPLOADS_DIR, { recursive: true });

    // Save file with unique name
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${timestamp}_${safeFileName}`;
    const filePath = join(UPLOADS_DIR, storedName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // Create meeting record
    const meeting = await db.meeting.create({
      data: {
        title: title || file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        fileUrl: filePath,
      },
    });

    // Kick off processing in background (fire-and-forget)
    processMeeting(meeting.id).catch(console.error);

    return NextResponse.json({ id: meeting.id }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
