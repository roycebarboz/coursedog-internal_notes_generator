import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseCsvRows, groupEvents } from "@/lib/csv-parser";
import { generateNotes } from "@/lib/note-generator";
import { fetchEvents } from "@/lib/coursedog";

export async function POST(request: Request) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { csvData } = body as { csvData: Record<string, string>[] };

    if (!csvData || !Array.isArray(csvData)) {
      return NextResponse.json({ error: "csvData must be an array of row objects" }, { status: 400 });
    }

    // 1. Parse CSV rows
    const rows = parseCsvRows(csvData);

    // 2. Group events by (name, date, building)
    const groups = groupEvents(rows);

    if (groups.length === 0) {
      return NextResponse.json({
        notes: [],
        message: "No events with Facilities Request = Yes found in the CSV.",
      });
    }

    // 3. Fetch event data from Coursedog for billing accounts
    const allEventIds = groups.flatMap((g) => g.eventIds);
    const coursedogEvents = await fetchEvents(allEventIds);

    // 4. Generate notes
    const notes = generateNotes(groups, rows, coursedogEvents);

    return NextResponse.json({
      notes: notes.map((n) => ({
        // Identifiers
        eventIds: n.eventGroup.eventIds,
        normalizedName: n.eventGroup.normalizedName,
        date: n.eventGroup.date,
        building: n.eventGroup.building,
        locations: n.eventGroup.locations,
        // Generated fields
        accountNumber: n.accountNumber,
        reservationNumber: n.reservationNumber,
        venueLabel: n.venueLabel,
        setupTimeLine: n.setupTimeLine,
        setupInstructions: n.setupInstructions,
        breakdownTimeLine: n.breakdownTimeLine,
        fullNote: n.fullNote,
        warnings: n.warnings,
      })),
    });
  } catch (err) {
    console.error("generate-notes error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
