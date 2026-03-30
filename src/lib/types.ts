// ── CSV row as parsed from the uploaded file ──
export interface CsvEventRow {
  eventName: string;
  dateTime: string; // e.g. "Mar 19, 2026 7:30 AM - 6:00 PM"
  location: string; // e.g. "UCC 106 (The Gallery)"
  internalNotes: string;
  eventId: string;
  facilitiesRequest: string; // "Yes" | "No" | "-"
}

// ── Parsed time range from the CSV date/time string ──
export interface ParsedDateTime {
  startDate: Date;
  endDate: Date;
  startHour: number; // 0-23
  startMinute: number; // 0-59
  endHour: number;
  endMinute: number;
  isAM: boolean; // true if event starts before noon
}

// ── Coursedog API event shape (relevant fields only) ──
export interface CoursedogEvent {
  id: string;
  name: string;
  customFields: {
    KzOtm?: string; // Billing Account Number
    kIyJw?: string; // Internal Events Notes (General Event)
    "53DcH"?: boolean; // Facilities Request?
    "97Sir"?: string; // Manager name
    [key: string]: unknown;
  };
  meetings: CoursedogMeeting[];
  [key: string]: unknown;
}

export interface CoursedogMeeting {
  id: string;
  roomId: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  startTime: number; // HHMM format, e.g. 730 = 7:30 AM
  endTime: number;
  isSetup: boolean;
  isTeardown: boolean;
  status: string;
  [key: string]: unknown;
}

// ── Grouped event: multiple CSV rows for the same logical event ──
export interface EventGroup {
  normalizedName: string;
  date: string; // "YYYY-MM-DD"
  eventIds: string[]; // may have multiple if client double-booked
  building: string; // e.g. "UCC", "Babbio", "Howe"
  locations: string[]; // all venue names in this building for this event
  rows: CsvEventRow[];
  parsedTimes: ParsedDateTime[];
  billingAccount: string;
  setupInstructions: string; // furniture details from manager
}

// ── Generated note ready for review ──
export interface GeneratedNote {
  eventGroup: EventGroup;
  accountNumber: string;
  reservationNumber: string;
  venueLabel: string;
  setupTimeLine: string; // e.g. "Please set up on Wednesday, March 18, at 3 PM"
  setupInstructions: string; // furniture details
  breakdownTimeLine: string; // e.g. "Please break down Saturday, March 21, in the AM"
  fullNote: string; // the complete formatted note
  warnings: string[]; // e.g. "Less than 60 min for setup — notify manager"
}
