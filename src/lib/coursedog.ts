import type { CoursedogEvent } from "./types";

const BASE_URL = "https://app.coursedog.com/api/v1";

// Custom field keys discovered from the API
export const CUSTOM_FIELDS = {
  BILLING_ACCOUNT: "KzOtm",
  INTERNAL_NOTES: "kIyJw",
  FACILITIES_REQUEST: "53DcH",
  MANAGER_NAME: "97Sir",
} as const;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/** Authenticate and get a bearer token (cached for 23 hours). */
export async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const email = process.env.COURSEDOG_EMAIL;
  const password = process.env.COURSEDOG_PASSWORD;
  if (!email || !password) throw new Error("Missing COURSEDOG_EMAIL or COURSEDOG_PASSWORD env vars");

  const resp = await fetch(`${BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Coursedog auth failed (${resp.status}): ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  cachedToken = data.token || data.accessToken || data.access_token;
  if (!cachedToken) throw new Error("No token in Coursedog auth response");

  // Cache for 23 hours (token lifetime is 24h)
  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken;
}

function getSchoolId(): string {
  return process.env.COURSEDOG_SCHOOL_ID || "stevens_workday";
}

/** Fetch a single event by ID. */
export async function fetchEvent(eventId: string): Promise<CoursedogEvent> {
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/em/${getSchoolId()}/events/${eventId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch event ${eventId}: ${resp.status}`);
  }

  return resp.json();
}

/** Fetch multiple events by IDs (parallel, with deduplication). */
export async function fetchEvents(eventIds: string[]): Promise<Map<string, CoursedogEvent>> {
  const unique = [...new Set(eventIds)];
  const results = await Promise.allSettled(unique.map((id) => fetchEvent(id)));
  const map = new Map<string, CoursedogEvent>();

  for (let i = 0; i < unique.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      map.set(unique[i], result.value);
    } else {
      console.error(`Failed to fetch event ${unique[i]}:`, result.reason);
    }
  }

  return map;
}

/** Update the internal events notes on a Coursedog event. */
export async function updateEventNotes(eventId: string, notes: string): Promise<void> {
  const token = await getToken();
  const schoolId = getSchoolId();

  // First fetch the current event to get its version
  const event = await fetchEvent(eventId);

  const resp = await fetch(`${BASE_URL}/em/${schoolId}/events/${eventId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...event,
      customFields: {
        ...event.customFields,
        [CUSTOM_FIELDS.INTERNAL_NOTES]: notes,
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to update event ${eventId}: ${resp.status} ${text.slice(0, 200)}`);
  }
}
