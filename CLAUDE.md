# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Turbopack dev server at localhost:3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

No test framework is configured.

## Architecture

**coursedog-notes** is a Next.js app that automates writing internal event notes for a facilities team. It reads a Coursedog CSV export, generates formatted notes with calculated setup/breakdown times, lets a user review/edit them, then submits the notes back to Coursedog via their REST API.

### Data Flow

```
CSV Upload → Parse Rows → Group Events → Fetch Coursedog Events (billing acct) → Generate Notes → Review/Edit → Submit to Coursedog API
```

### Key Directories

- `src/app/` — Next.js App Router pages and API routes
- `src/lib/` — All business logic (no UI)
- `Context/` — Reference docs: API spec, venue code lists, process diagrams

### Core Library Modules (`src/lib/`)

| File | Purpose |
|---|---|
| `note-generator.ts` | The heart of the app. Complex rule-based setup/breakdown time calculation (350+ lines). |
| `csv-parser.ts` | Parses Coursedog CSV exports, normalizes date/time formats, groups events by name+building+date clusters. |
| `coursedog.ts` | Coursedog REST API client. Handles bearer token auth (23-hour cache), event fetching, and note updates. |
| `venue-codes.ts` | Maps 200+ Coursedog location strings to short venue codes for reservation numbers. |
| `types.ts` | Shared TypeScript types. |

### Note Generation Rules (see `note-generator.ts`)

Setup time has many edge cases:
- Default: 2 hours before event start
- No setup during 12–1 PM lunch break
- Earliest setup: 6 AM (facility hours 8 AM–5 PM)
- If <60 min after prior event: warn manager; if exactly 60 min: append "SHARP"
- Post-5 PM events with free venue: setup at 11 AM
- Early morning outdoor events with minimal setup: 1 hour before
- Prior-day setup at 4 PM if venue free; Monday exception keeps 2 hrs before (weekend premium)

Breakdown time rules:
- Default: next day AM
- If subsequent event has setup in same venue: same day PM
- Weekend event with no weekend followup: Monday AM

### Coursedog API

- Base URL: `https://app.coursedog.com/api/v1`
- Custom field IDs (hardcoded in `coursedog.ts`): BILLING_ACCOUNT: `KzOtm`, INTERNAL_NOTES: `kIyJw`, FACILITIES_REQUEST: `53DcH`, MANAGER_NAME: `97Sir`

### Authentication

NextAuth credentials provider with a hardcoded user list in `src/lib/auth.ts`. Supports up to 5 users via `ALLOWED_EMAIL_3`–`ALLOWED_EMAIL_5` env vars. JWT session strategy.

### State Between Pages

Notes are passed between the Upload and Review pages via `sessionStorage` — there is no database.

### Environment Variables

Required in `.env.local`:
- `COURSEDOG_EMAIL` / `COURSEDOG_PASSWORD` — Coursedog service account
- `COURSEDOG_SCHOOL_ID` — e.g. `stevens_workday`
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL`
- `LOGIN_PASSWORD_1` / `LOGIN_PASSWORD_2` — app login passwords
