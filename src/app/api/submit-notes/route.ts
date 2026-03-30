import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateEventNotes } from "@/lib/coursedog";

interface NoteSubmission {
  eventIds: string[];
  fullNote: string;
}

export async function POST(request: Request) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { notes } = body as { notes: NoteSubmission[] };

    if (!notes || !Array.isArray(notes)) {
      return NextResponse.json({ error: "notes must be an array" }, { status: 400 });
    }

    const results: { eventId: string; success: boolean; error?: string }[] = [];

    // Update each event in Coursedog
    for (const submission of notes) {
      for (const eventId of submission.eventIds) {
        try {
          await updateEventNotes(eventId, submission.fullNote);
          results.push({ eventId, success: true });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          results.push({ eventId, success: false, error: message });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Updated ${successCount} event(s). ${failCount > 0 ? `${failCount} failed.` : ""}`,
      results,
    });
  } catch (err) {
    console.error("submit-notes error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
