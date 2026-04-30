import type { CsvEventRow, EventGroup, GeneratedNote, ParsedDateTime, VenueTimelineEntry, VenueTimelines } from "./types";
import type { CoursedogEvent } from "./types";
import { CUSTOM_FIELDS } from "./coursedog";
import {
  getReservationVenueCode,
  getVenueLabel,
} from "./venue-codes";
import {
  normalizeEventName,
  parseDateTime,
  toDateKey,
  toMMDD,
} from "./csv-parser";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Helpers ──

function formatTime12h(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h = hour % 12 || 12;
  if (minute === 0) return `${h} ${ampm}`;
  return `${h}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function minutesToTime(totalMinutes: number): { hour: number; minute: number } {
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

function timeToMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

function getNextMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return d;
}

function getNextDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  return d;
}

function getPrevDay(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d;
}

function formatDateReadable(date: Date): string {
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// ── Venue Timeline from API ──

/**
 * Build a VenueTimelines lookup from raw Coursedog meetings API response.
 * The API returns an object keyed by meeting ID.
 */
export function buildVenueTimelines(
  rawMeetings: Record<string, Record<string, unknown>>
): VenueTimelines {
  const map: VenueTimelines = new Map();

  for (const m of Object.values(rawMeetings)) {
    const roomId = m.roomId as string | undefined;
    const startDate = m.startDate as string | undefined;
    if (!roomId || !startDate) continue;

    const startTime = m.startTime as number;
    const endTime = m.endTime as number;

    const entry: VenueTimelineEntry = {
      start: Math.floor(startTime / 100) * 60 + (startTime % 100),
      end: Math.floor(endTime / 100) * 60 + (endTime % 100),
      name: (m.eventData as { name?: string })?.name ?? "",
      eventId: (m.eventId as string) ?? "",
      isSetup: (m.isSetup as boolean) ?? false,
      isTeardown: (m.isTeardown as boolean) ?? false,
    };

    if (!map.has(roomId)) map.set(roomId, new Map());
    const roomMap = map.get(roomId)!;
    if (!roomMap.has(startDate)) roomMap.set(startDate, []);
    roomMap.get(startDate)!.push(entry);
  }

  // Sort each date's entries by start time
  for (const roomMap of map.values()) {
    for (const entries of roomMap.values()) {
      entries.sort((a, b) => a.start - b.start);
    }
  }

  return map;
}

/**
 * Look up all events at a venue on a specific date from the pre-built API timeline.
 * Drop-in replacement for the old CSV-based getVenueTimeline.
 */
function getVenueTimeline(
  venueTimelines: VenueTimelines,
  venue: string,
  dateKey: string
): VenueTimelineEntry[] {
  return venueTimelines.get(venue)?.get(dateKey) ?? [];
}

/** Returns true if any of the event's locations is an outdoor space (patio, lawn, etc.). */
function isOutdoorVenue(locations: string[]): boolean {
  const outdoorKeywords = /patio|lawn|outdoor|outside|terrace|courtyard|field|plaza|garden|roof|deck/i;
  return locations.some((loc) => outdoorKeywords.test(loc));
}

/**
 * Returns true if the setup is minimal: at most 1 table AND at most 2 chairs total,
 * and no other significant items. Used for the outdoor 1-hour-before exception.
 */
function isMinimalOutdoorSetup(rows: CsvEventRow[]): boolean {
  const notes = rows.map((r) => r.internalNotes).join(" ").toLowerCase();
  if (!notes.trim()) return true; // no instructions = nothing to set up

  // Extract the first number before "table(s)"
  const tableMatch = notes.match(/(\d+)\s*tables?/);
  const tableCount = tableMatch ? parseInt(tableMatch[1]) : 0;

  // Extract the first number before "chair(s)"
  const chairMatch = notes.match(/(\d+)\s*chairs?/);
  const chairCount = chairMatch ? parseInt(chairMatch[1]) : 0;

  return tableCount <= 1 && chairCount <= 2;
}

/**
 * Parse internal notes into setup instructions (content inside {braces})
 * and additional notes (everything outside braces).
 *
 * If no braces are present, the entire string is treated as setup instructions
 * (preserving existing behavior).
 */
function parseInternalNotes(raw: string): {
  setupInstructions: string;
  additionalNotes: string;
} {
  if (!raw) return { setupInstructions: "", additionalNotes: "" };

  const braceMatch = raw.match(/\{([\s\S]*?)\}/);
  if (!braceMatch) {
    // No braces — entire string is setup instructions (legacy behavior)
    return { setupInstructions: raw.trim(), additionalNotes: "" };
  }

  const setupInstructions = braceMatch[1].trim();
  const additionalNotes = raw
    .replace(braceMatch[0], "")
    .trim();

  return { setupInstructions, additionalNotes };
}

// ── Setup Time Calculation ──

/**
 * Calculate setup time following all edge cases from the PRD:
 *   Default: 2 hours before event start
 *   a. No setup between 12–1 PM (lunch break)
 *   b. Facilities work hours 8 AM – 5 PM; earliest possible is 6 AM
 *   c. Setup must not overlap with other events in the same venue
 *   d. If < 60 min available after prior event → warn manager
 *      If exactly 60 min → append "SHARP"
 *   e. If event after 5 PM and no event at that venue → setup at 11 AM
 */
function calculateSetupTime(
  eventGroup: EventGroup,
  venueTimelines: VenueTimelines
): { setupDate: Date; setupTime: string; warnings: string[] } {
  const warnings: string[] = [];

  // Find the earliest main event time (not Setup: or Teardown: rows)
  const mainRows = eventGroup.rows.filter(
    (r) => !r.eventName.match(/^(Setup|Teardown)\s*:/i)
  );
  const mainTimes = mainRows
    .map((r) => parseDateTime(r.dateTime))
    .filter((t): t is ParsedDateTime => t !== null);

  if (mainTimes.length === 0) {
    // Fall back to any row
    const anyTime = eventGroup.parsedTimes[0];
    if (!anyTime) return { setupDate: new Date(), setupTime: "TBD", warnings: ["No time data found"] };
    mainTimes.push(anyTime);
  }

  // Earliest start time across all main event rows
  const earliest = mainTimes.reduce((a, b) =>
    timeToMinutes(a.startHour, a.startMinute) < timeToMinutes(b.startHour, b.startMinute) ? a : b
  );

  const eventStartMin = timeToMinutes(earliest.startHour, earliest.startMinute);
  const eventDate = earliest.startDate;
  const dateKey = toDateKey(eventDate);

  // Edge case (e): After 5 PM and no event at venue → setup at 11 AM
  if (eventStartMin >= timeToMinutes(17, 0)) {
    let venueIsFree = true;
    for (const loc of eventGroup.locations) {
      const timeline = getVenueTimeline(venueTimelines, loc, dateKey);
      const otherEvents = timeline.filter(
        (e) => normalizeEventName(e.name) !== eventGroup.normalizedName
      );
      if (otherEvents.some((e) => e.start < timeToMinutes(17, 0))) {
        venueIsFree = false;
        break;
      }
    }
    if (venueIsFree) {
      return {
        setupDate: eventDate,
        setupTime: `Please set up on ${formatDateReadable(eventDate)}, at 11 AM`,
        warnings,
      };
    }
  }

  // Default: 2 hours before event start
  let setupMin = eventStartMin - 120;
  let setupDate = eventDate;
  let priorDay = false;

  // Early-morning prior-day rule: if setup lands before 8 AM
  if (setupMin < timeToMinutes(8, 0)) {
    const isMonday = eventDate.getDay() === 1;
    const isOutdoor = isOutdoorVenue(eventGroup.locations);

    if (isMonday) {
      // Monday exception: facilities charge extra on weekends → keep 2 hrs before,
      // no prior-day shift, no 6 AM cap.
    } else if (isOutdoor) {
      // Outdoor venue exception: no prior-day shift.
      // If setup is minimal (≤1 table and ≤2 chairs) → 1 hour before instead of 2.
      if (isMinimalOutdoorSetup(eventGroup.rows)) {
        setupMin = eventStartMin - 60;
      }
      // else: keep 2 hrs before (setupMin stays as-is)
    } else {
      // Move setup to previous day at 4 PM, but only if venue is free after 4 PM
      const prevDay = getPrevDay(eventDate);
      const prevDayKey = toDateKey(prevDay);
      let venueFreeAfter4PM = true;
      for (const loc of eventGroup.locations) {
        const prevTimeline = getVenueTimeline(venueTimelines, loc, prevDayKey);
        if (prevTimeline.some((e) => e.end > timeToMinutes(16, 0))) {
          venueFreeAfter4PM = false;
          break;
        }
      }
      if (venueFreeAfter4PM) {
        setupDate = prevDay;
        setupMin = timeToMinutes(16, 0);
        priorDay = true;
      } else {
        // Fallback: cap at 6 AM
        setupMin = timeToMinutes(6, 0);
      }
    }
  }

  // Edge case (a): No setup between 12–1 PM (lunch break) — same-day only
  if (!priorDay && setupMin >= timeToMinutes(12, 0) && setupMin < timeToMinutes(13, 0)) {
    setupMin = timeToMinutes(11, 0);
  }

  // Edge case (c) & (d): Check for venue conflicts — same-day setup only
  let sharp = false;
  if (!priorDay) {
    for (const loc of eventGroup.locations) {
      const timeline = getVenueTimeline(venueTimelines, loc, dateKey);
      const otherEvents = timeline.filter(
        (e) => normalizeEventName(e.name) !== eventGroup.normalizedName
      );

      for (const other of otherEvents) {
        if (setupMin < other.end && eventStartMin > other.start) {
          const gapAfterOther = eventStartMin - other.end;

          if (gapAfterOther < 60) {
            warnings.push(
              `Less than 60 min for setup at ${loc} — prior event "${other.name}" ends at ${formatTime12h(...Object.values(minutesToTime(other.end)) as [number, number])}. Notify manager.`
            );
            setupMin = other.end;
          } else if (gapAfterOther === 60) {
            setupMin = other.end;
            sharp = true;
          } else {
            setupMin = Math.max(setupMin, other.end);
          }
        }
      }
    }

    // Re-check lunch break after conflict adjustments
    if (setupMin >= timeToMinutes(12, 0) && setupMin < timeToMinutes(13, 0)) {
      setupMin = timeToMinutes(13, 0);
    }
  }

  // If any Setup: row explicitly gives a different date, honour it
  const setupRows = eventGroup.rows.filter((r) =>
    r.eventName.match(/^Setup\s*:/i)
  );
  if (setupRows.length > 0) {
    const setupParsed = parseDateTime(setupRows[0].dateTime);
    if (setupParsed && toDateKey(setupParsed.startDate) !== dateKey) {
      setupDate = setupParsed.startDate;
      setupMin = timeToMinutes(setupParsed.startHour, setupParsed.startMinute);
    }
  }

  const { hour, minute } = minutesToTime(setupMin);
  const timeStr = formatTime12h(hour, minute) + (sharp ? " SHARP" : "");

  return {
    setupDate,
    setupTime: `Please set up on ${formatDateReadable(setupDate)}, at ${timeStr}`,
    warnings,
  };
}

// ── Breakdown Time Calculation ──

/**
 * Calculate breakdown time following edge cases:
 *   Default: next day in the AM
 *   a. If there's an event after this with setup in the same venue → PM (same day)
 *   b. If event is on weekend and no event in that space after it on weekends → Monday AM
 */
function calculateBreakdownTime(
  eventGroup: EventGroup,
  venueTimelines: VenueTimelines
): string {
  // Find the latest end time across main event rows
  const mainRows = eventGroup.rows.filter(
    (r) => !r.eventName.match(/^(Setup|Teardown)\s*:/i)
  );
  const mainTimes = mainRows
    .map((r) => parseDateTime(r.dateTime))
    .filter((t): t is ParsedDateTime => t !== null);

  if (mainTimes.length === 0) return "Please break down the next day in the AM";

  const latest = mainTimes.reduce((a, b) =>
    timeToMinutes(a.endHour, a.endMinute) > timeToMinutes(b.endHour, b.endMinute) ? a : b
  );

  const eventDate = latest.endDate;
  const dateKey = toDateKey(eventDate);
  const eventEndMin = timeToMinutes(latest.endHour, latest.endMinute);

  // Edge case (a): Check if there's a subsequent event with setup in the same venue
  for (const loc of eventGroup.locations) {
    const timeline = getVenueTimeline(venueTimelines, loc, dateKey);
    // Get later non-setup/non-teardown events (main meetings only)
    const laterEvents = timeline.filter(
      (e) =>
        e.start >= eventEndMin &&
        !e.isSetup &&
        !e.isTeardown &&
        normalizeEventName(e.name) !== eventGroup.normalizedName
    );

    // Check if any later event has a setup meeting in this venue
    for (const later of laterEvents) {
      const hasSetup = timeline.some(
        (e) =>
          e.isSetup &&
          e.eventId === later.eventId
      );
      if (hasSetup) {
        return "Please break down in the PM";
      }
    }
  }

  // Edge case (b): Weekend event with no following weekend event → Monday AM
  if (isWeekend(eventDate)) {
    let hasWeekendFollowup = false;

    // Check Saturday (if today is Friday/Saturday) and Sunday
    for (const loc of eventGroup.locations) {
      // Check the rest of today and tomorrow if still weekend
      const tomorrow = getNextDay(eventDate);
      if (isWeekend(tomorrow)) {
        const tomorrowKey = toDateKey(tomorrow);
        const tomorrowTimeline = getVenueTimeline(venueTimelines, loc, tomorrowKey);
        if (tomorrowTimeline.length > 0) {
          hasWeekendFollowup = true;
          break;
        }
      }

      // Also check remaining events today after ours
      const todayTimeline = getVenueTimeline(venueTimelines, loc, dateKey);
      const laterToday = todayTimeline.filter(
        (e) =>
          e.start > eventEndMin &&
          normalizeEventName(e.name) !== eventGroup.normalizedName
      );
      if (laterToday.length > 0) {
        hasWeekendFollowup = true;
        break;
      }
    }

    if (!hasWeekendFollowup) {
      const monday = getNextMonday(eventDate);
      return `Please break down on Monday, ${MONTHS[monday.getMonth()]} ${monday.getDate()}, in the AM`;
    }
  }

  // Default: next day AM
  const nextDay = getNextDay(eventDate);
  const dayName = DAYS[nextDay.getDay()];

  // If next day is a known day, use the day name
  return `Please break down on ${dayName}, in the AM`;
}

// ── Main Generator ──

/**
 * Generate internal event notes for all event groups.
 */
export function generateNotes(
  eventGroups: EventGroup[],
  coursedogEvents: Map<string, CoursedogEvent>,
  venueTimelines: VenueTimelines
): GeneratedNote[] {
  const notes: GeneratedNote[] = [];

  for (const group of eventGroups) {
    // Get billing account from Coursedog API
    let accountNumber = "";
    for (const eid of group.eventIds) {
      const event = coursedogEvents.get(eid);
      if (event?.customFields && !accountNumber && event.customFields[CUSTOM_FIELDS.BILLING_ACCOUNT]) {
        accountNumber = event.customFields[CUSTOM_FIELDS.BILLING_ACCOUNT] as string;
      }
    }

    // Determine setup instructions and additional notes from CSV internalNotes column.
    // Content inside {braces} → setup instructions (placed after setup time line).
    // Content outside braces → additional notes (placed after breakdown with two blank lines).
    // If no braces, fall back to legacy behavior (entire string = setup instructions).
    let setupInstructions = group.setupInstructions;
    let additionalNotes = "";
    if (!setupInstructions) {
      const csvNotes = group.rows.find((r) => r.internalNotes)?.internalNotes ?? "";
      if (csvNotes) {
        if (csvNotes.toLowerCase().includes("please set up")) {
          setupInstructions = extractSetupInstructions(csvNotes);
        } else {
          const parsed = parseInternalNotes(csvNotes);
          setupInstructions = parsed.setupInstructions;
          additionalNotes = parsed.additionalNotes;
        }
      }
    }

    // Calculate reservation number: MMDDVENUE_CODEAM/PM
    const eventDate = group.parsedTimes[0]?.startDate;
    const mmdd = eventDate ? toMMDD(eventDate) : "0000";
    const venueCode = getReservationVenueCode(group.locations);
    const ampm = group.parsedTimes[0]?.isAM ? "AM" : "PM";
    const reservationNumber = `${mmdd}${venueCode}${ampm}`;

    // Get venue label
    const venueLabel = getVenueLabel(group.locations);

    // Calculate setup and breakdown times
    const { setupTime, warnings } = calculateSetupTime(group, venueTimelines);
    const breakdownTime = calculateBreakdownTime(group, venueTimelines);

    // Build the full note
    const fullNote = buildNoteText({
      accountNumber,
      reservationNumber,
      venueLabel,
      setupTime,
      setupInstructions,
      breakdownTime,
      additionalNotes,
    });

    notes.push({
      eventGroup: group,
      accountNumber,
      reservationNumber,
      venueLabel,
      setupTimeLine: setupTime,
      setupInstructions,
      breakdownTimeLine: breakdownTime,
      additionalNotes,
      fullNote,
      warnings,
    });
  }

  return notes;
}

/**
 * Extract setup instructions (furniture details) from an existing note.
 * These appear between the "Please set up" line and the "Please break down" line.
 */
function extractSetupInstructions(existingNote: string): string {
  const lines = existingNote.split("\n");
  let capturing = false;
  const instructions: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith("please set up")) {
      capturing = true;
      continue;
    }
    if (line.toLowerCase().startsWith("please break down") || line.toLowerCase().startsWith("please breakdown")) {
      capturing = false;
      continue;
    }
    if (capturing) {
      instructions.push(line);
    }
  }

  // Trim empty lines from start and end
  while (instructions.length > 0 && instructions[0].trim() === "") instructions.shift();
  while (instructions.length > 0 && instructions[instructions.length - 1].trim() === "") instructions.pop();

  return instructions.join("\n");
}

/**
 * Build the formatted note text from components.
 */
function buildNoteText(parts: {
  accountNumber: string;
  reservationNumber: string;
  venueLabel: string;
  setupTime: string;
  setupInstructions: string;
  breakdownTime: string;
  additionalNotes: string;
}): string {
  const lines: string[] = [];

  lines.push(`Account Number: ${parts.accountNumber}`);
  lines.push(`Reservation Number: ${parts.reservationNumber}`);
  lines.push(`${parts.venueLabel}: `);
  lines.push(parts.setupTime);

  if (parts.setupInstructions) {
    lines.push(parts.setupInstructions);
  }

  lines.push("");
  lines.push(parts.breakdownTime);

  if (parts.additionalNotes) {
    lines.push("");
    lines.push("");
    lines.push(parts.additionalNotes);
  }

  return lines.join("\n");
}

/**
 * Rebuild a full note from individually edited fields.
 * Used when the user edits fields in the review screen.
 */
export function rebuildNoteText(
  accountNumber: string,
  reservationNumber: string,
  venueLabel: string,
  setupTime: string,
  setupInstructions: string,
  breakdownTime: string,
  additionalNotes: string
): string {
  return buildNoteText({
    accountNumber,
    reservationNumber,
    venueLabel,
    setupTime,
    setupInstructions,
    breakdownTime,
    additionalNotes,
  });
}
