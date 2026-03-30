# Coursedog Internal Notes Generator

A Next.js app that automates writing internal event notes for the facilities team — replacing a tedious manual process with a one-click workflow.

---

## The Problem It Solves

### Before: Manual Process

![Manual BEO process](Context/manual-process_of_BEO_for_internal_notes.png)

Previously, a staff member had to:
1. Pull the event CSV from Coursedog manually
2. Look up the billing account number for each event
3. Look up venue codes for each location
4. Manually calculate setup and breakdown times (following a complex set of rules around lunch breaks, facility hours, prior/subsequent events, weekends, etc.)
5. Write out all notes by hand and email the completed template

This was error-prone and time-consuming, especially for large event weeks.

### After: Automated Process

![Automated notes process](Context/automated-process_of_event_notes_for_coursedog.png)

The app automates everything:
1. Manager downloads the CSV from Coursedog and uploads it to the app
2. The app parses events, fetches billing accounts from the Coursedog API, calculates all setup/breakdown times, and generates formatted notes
3. The manager reviews and edits the generated notes in-browser
4. One click submits the notes back to Coursedog via the REST API

---

## Setup

### Prerequisites

- Node.js 18+
- A Coursedog service account with API access

### Install

```bash
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Coursedog service account credentials
COURSEDOG_EMAIL=your-service-account@example.com
COURSEDOG_PASSWORD=your-password
COURSEDOG_SCHOOL_ID=stevens_workday

# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# App login credentials (up to 5 users)
LOGIN_PASSWORD_1=password-for-user-1
LOGIN_PASSWORD_2=password-for-user-2

# Optional: additional user emails
# ALLOWED_EMAIL_3=user3@example.com
# ALLOWED_EMAIL_4=user4@example.com
# ALLOWED_EMAIL_5=user5@example.com
```

### Run

```bash
npm run dev       # Development server at localhost:3000
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
```

---

## How to Use

### Step 1 — Export CSV from Coursedog

In Coursedog, navigate to your events view and export the event list as a CSV file.

### Step 2 — Upload the CSV

Log in to the app at `http://localhost:3000` and upload the CSV on the main page. The app will:
- Parse and group events by name, building, and date cluster
- Fetch each event's billing account from the Coursedog API
- Calculate setup and breakdown times using the full rule set (see below)
- Generate formatted internal notes for each event

### Step 3 — Review and Edit

The Review page displays all generated notes. You can edit any note inline before submitting. Notes that require manager attention (e.g., tight setup windows under 60 minutes) are flagged automatically.

### Step 4 — Submit to Coursedog

Click **Submit** to push all notes back to Coursedog via the REST API. The app updates the `INTERNAL_NOTES` custom field on each event.

---

## Note Generation Rules

Setup time logic (in priority order):

1. Default setup is **2 hours before** event start
2. No setup during the **12–1 PM lunch break**
3. Earliest possible setup is **6 AM** (facility hours: 8 AM–5 PM)
4. If less than 60 min after a prior event in the same venue → **warn manager**; if exactly 60 min → append **"SHARP"**
5. Post-5 PM events with a free venue → setup at **11 AM**
6. Early morning outdoor events with minimal setup → **1 hour before**
7. If the event start would be before 8 AM → prior-day setup at **4 PM** (if venue is free); Monday events keep 2 hrs before (weekend premium)

Breakdown time logic:

1. Default: **next day AM**
2. If a subsequent event has setup in the same venue the same day → **same day PM**
3. Weekend event with no weekend follow-up → **Monday AM**

---

## Architecture

```
CSV Upload → Parse Rows → Group Events → Fetch Coursedog Events → Generate Notes → Review/Edit → Submit to Coursedog API
```

| Module | Purpose |
|---|---|
| `src/lib/note-generator.ts` | All setup/breakdown time calculation logic (~350 lines) |
| `src/lib/csv-parser.ts` | Parses CSV, normalizes dates/times, groups events into clusters |
| `src/lib/coursedog.ts` | Coursedog REST API client with 23-hour bearer token cache |
| `src/lib/venue-codes.ts` | Maps 200+ location strings to short venue codes |
| `src/lib/types.ts` | Shared TypeScript types |
| `src/app/` | Next.js App Router pages and API routes |

Notes are passed between the Upload and Review pages via `sessionStorage` — there is no database.

---

## Coursedog API Details

- Base URL: `https://app.coursedog.com/api/v1`
- Auth: Bearer token (fetched from credentials, cached for 23 hours)
- Custom field IDs used:
  - `BILLING_ACCOUNT`: `KzOtm`
  - `INTERNAL_NOTES`: `kIyJw`
  - `FACILITIES_REQUEST`: `53DcH`
  - `MANAGER_NAME`: `97Sir`
