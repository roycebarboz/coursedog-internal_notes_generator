import type { CsvEventRow, EventGroup, ParsedDateTime } from "./types";
import { extractBuilding } from "./venue-codes";

/** CSV column headers as they appear in the Coursedog export. */
export const COL = {
  NAME: "Event Name",
  DATE_TIME: "Date & Time",
  LOCATION: "Location",
  MEETING_TYPE: "Meeting Type",
  NOTES: "Internal Events Notes  (General Event)",
  EVENT_ID: "Event ID",
  FACILITIES: "Facilities Request ? (General Event)",
} as const;

/**
 * Parse raw CSV data (array of objects from PapaParse) into typed rows.
 */
export function parseCsvRows(rawRows: Record<string, string>[]): CsvEventRow[] {
  return rawRows
    .map((row) => ({
      eventName: (row[COL.NAME] || "").trim(),
      dateTime: (row[COL.DATE_TIME] || "").trim(),
      location: (row[COL.LOCATION] || "").trim(),
      meetingType: (row[COL.MEETING_TYPE] || "").trim(),
      internalNotes: (row[COL.NOTES] || "").trim(),
      eventId: (row[COL.EVENT_ID] || "").trim(),
      facilitiesRequest: (row[COL.FACILITIES] || "").trim(),
    }))
    .filter(
      (row) =>
        row.eventName &&
        row.eventId &&
        row.meetingType.toLowerCase() === "main meeting"
    );
}

/**
 * Strip "Setup:", "Teardown:" prefixes and trim whitespace.
 */
export function normalizeEventName(name: string): string {
  return name
    .replace(/^(Setup|Teardown)\s*:\s*/i, "")
    .trim();
}

/**
 * Parse the CSV "Date & Time" field into structured date/time info.
 *
 * Formats handled:
 *   "Mar 19, 2026 7:30 AM - 6:00 PM"
 *   "Mar 19, 2026 8:00 AM - Mar 20, 2026 5:00 PM"
 *   "23-Mar-26"  (date only)
 */
export function parseDateTime(dateTimeStr: string): ParsedDateTime | null {
  if (!dateTimeStr) return null;

  // Handle "DD-Mon-YY" format (e.g. "23-Mar-26")
  const shortMatch = dateTimeStr.match(/^(\d{1,2})-([A-Za-z]+)-(\d{2})$/);
  if (shortMatch) {
    const day = parseInt(shortMatch[1]);
    const monthStr = shortMatch[2];
    const year = 2000 + parseInt(shortMatch[3]);
    const date = new Date(`${monthStr} ${day}, ${year}`);
    return {
      startDate: date,
      endDate: date,
      startHour: 0,
      startMinute: 0,
      endHour: 23,
      endMinute: 59,
      isAM: true,
    };
  }

  // Split on " - " to separate start and end
  const parts = dateTimeStr.split(" - ");
  if (parts.length !== 2) return null;

  const startStr = parts[0].trim();
  const endStr = parts[1].trim();

  // Parse start: "Mar 19, 2026 7:30 AM"
  const startDate = new Date(startStr);
  if (isNaN(startDate.getTime())) return null;

  // End might be "6:00 PM" (same day) or "Mar 20, 2026 5:00 PM" (different day)
  let endDate: Date;
  const endHasDate = /[A-Za-z]{3}\s+\d/.test(endStr);
  if (endHasDate) {
    endDate = new Date(endStr);
  } else {
    // Same day, just time: reconstruct with start's date
    const datePrefix = startStr.replace(/\d{1,2}:\d{2}\s*(AM|PM)$/i, "").trim();
    endDate = new Date(`${datePrefix} ${endStr}`);
  }
  if (isNaN(endDate.getTime())) return null;

  return {
    startDate,
    endDate,
    startHour: startDate.getHours(),
    startMinute: startDate.getMinutes(),
    endHour: endDate.getHours(),
    endMinute: endDate.getMinutes(),
    isAM: startDate.getHours() < 12,
  };
}

/**
 * Format a Date to "YYYY-MM-DD".
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date to "MMDD" for the reservation number.
 */
export function toMMDD(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}${d}`;
}

/**
 * Group CSV rows into EventGroups:
 *   1. Group by (normalized name, building) — catches same event across IDs
 *   2. Cluster the collected dates into consecutive runs — each run = ONE note
 *      (multi-day rule: same event spanning consecutive days → one internal note,
 *       reservation number uses the first day; non-consecutive dates → separate notes)
 *   3. Different buildings always get separate notes
 */
export function groupEvents(rows: CsvEventRow[]): EventGroup[] {
  // Step 1: collect all eligible rows per (normalizedName, building)
  const superMap = new Map<string, CsvEventRow[]>();

  for (const row of rows) {
    if (row.facilitiesRequest !== "Yes") continue;
    if (!row.location || row.location === "-") continue;

    const normalizedName = normalizeEventName(row.eventName);
    const parsed = parseDateTime(row.dateTime);
    if (!parsed) continue;

    const building = extractBuilding(row.location);
    const key = `${normalizedName}|||${building}`;
    const arr = superMap.get(key) ?? [];
    arr.push(row);
    superMap.set(key, arr);
  }

  const result: EventGroup[] = [];

  for (const [key, groupRows] of superMap) {
    const [normalizedName, building] = key.split("|||");

    // Step 2: collect unique dates and sort them
    const dateSet = new Set<string>();
    for (const row of groupRows) {
      const parsed = parseDateTime(row.dateTime);
      if (parsed) dateSet.add(toDateKey(parsed.startDate));
    }
    const sortedDates = [...dateSet].sort();

    // Cluster dates into consecutive runs (gap > 1 day → new cluster)
    const clusters: string[][] = [];
    let current: string[] = [];
    for (const dateKey of sortedDates) {
      if (current.length === 0) {
        current.push(dateKey);
      } else {
        const last = new Date(current[current.length - 1]);
        const thisD = new Date(dateKey);
        const dayGap =
          (thisD.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        if (dayGap <= 1) {
          current.push(dateKey);
        } else {
          clusters.push(current);
          current = [dateKey];
        }
      }
    }
    if (current.length > 0) clusters.push(current);

    // Step 3: one EventGroup per cluster
    for (const cluster of clusters) {
      const clusterSet = new Set(cluster);

      // Sort cluster rows chronologically so parsedTimes[0] is always the earliest
      const clusterRows = groupRows
        .filter((row) => {
          const parsed = parseDateTime(row.dateTime);
          return parsed && clusterSet.has(toDateKey(parsed.startDate));
        })
        .sort((a, b) => {
          const pa = parseDateTime(a.dateTime);
          const pb = parseDateTime(b.dateTime);
          if (!pa || !pb) return 0;
          return pa.startDate.getTime() - pb.startDate.getTime();
        });

      const group: EventGroup = {
        normalizedName,
        date: cluster[0], // first day — used for reservation number MMDD
        eventIds: [],
        building,
        locations: [],
        rows: [],
        parsedTimes: [],
        billingAccount: "",
        setupInstructions: "",
      };

      for (const row of clusterRows) {
        if (!group.eventIds.includes(row.eventId)) {
          group.eventIds.push(row.eventId);
        }
        if (!group.locations.includes(row.location)) {
          group.locations.push(row.location);
        }
        group.rows.push(row);
        const parsed = parseDateTime(row.dateTime);
        if (parsed) group.parsedTimes.push(parsed);
      }

      result.push(group);
    }
  }

  return result;
}

/**
 * Get ALL events in the CSV for a specific venue on a specific date,
 * regardless of Facilities Request. Used for conflict detection.
 */
export function getVenueTimeline(
  allRows: CsvEventRow[],
  venue: string,
  dateKey: string
): { start: number; end: number; name: string }[] {
  const timeline: { start: number; end: number; name: string }[] = [];

  for (const row of allRows) {
    if (row.location !== venue) continue;
    const parsed = parseDateTime(row.dateTime);
    if (!parsed) continue;
    if (toDateKey(parsed.startDate) !== dateKey) continue;

    const startMinutes = parsed.startHour * 60 + parsed.startMinute;
    const endMinutes = parsed.endHour * 60 + parsed.endMinute;
    timeline.push({
      start: startMinutes,
      end: endMinutes,
      name: row.eventName,
    });
  }

  // Sort by start time
  timeline.sort((a, b) => a.start - b.start);
  return timeline;
}
