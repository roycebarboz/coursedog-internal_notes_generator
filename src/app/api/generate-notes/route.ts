import { NextResponse } from "next/server";
import { parseCsvRows, groupEvents } from "@/lib/csv-parser";
import { generateNotes, buildVenueTimelines } from "@/lib/note-generator";
import { fetchEvents, fetchMeetings } from "@/lib/coursedog";

export async function POST(request: Request) {
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

    // 4. Determine date range and fetch all room meetings from Coursedog
    //    Include ±1 day buffer for prior-day setup and next-day breakdown checks
    const sortedDates = groups.map((g) => g.date).sort();
    const firstDate = new Date(sortedDates[0]);
    const lastDate = new Date(sortedDates[sortedDates.length - 1]);
    firstDate.setDate(firstDate.getDate() - 1);
    lastDate.setDate(lastDate.getDate() + 1);
    const toISO = (d: Date) => d.toISOString().slice(0, 10);

    const rawMeetings = await fetchMeetings(toISO(firstDate), toISO(lastDate));
    const venueTimelines = buildVenueTimelines(rawMeetings);

    // 5. Generate notes
    const notes = generateNotes(groups, coursedogEvents, venueTimelines);

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
