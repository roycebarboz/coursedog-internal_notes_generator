"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface NoteData {
  eventIds: string[];
  normalizedName: string;
  date: string;
  building: string;
  locations: string[];
  accountNumber: string;
  reservationNumber: string;
  venueLabel: string;
  setupTimeLine: string;
  setupInstructions: string;
  breakdownTimeLine: string;
  fullNote: string;
  warnings: string[];
}

export default function ReviewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    const stored = sessionStorage.getItem("generatedNotes");
    if (!stored) {
      router.push("/upload");
      return;
    }

    try {
      setNotes(JSON.parse(stored));
    } catch {
      router.push("/upload");
    }
  }, [status, router]);

  function updateNote(index: number, field: keyof NoteData, value: string) {
    setNotes((prev) => {
      const updated = [...prev];
      const note = { ...updated[index], [field]: value };

      // Rebuild fullNote when individual fields change
      if (
        ["accountNumber", "reservationNumber", "venueLabel", "setupTimeLine", "setupInstructions", "breakdownTimeLine"].includes(field)
      ) {
        const lines = [
          `Account Number: ${note.accountNumber}`,
          `Reservation Number: ${note.reservationNumber}`,
          `${note.venueLabel}: `,
          note.setupTimeLine,
        ];
        if (note.setupInstructions) {
          lines.push(note.setupInstructions);
        }
        lines.push("");
        lines.push(note.breakdownTimeLine);
        note.fullNote = lines.join("\n");
      }

      updated[index] = note;
      return updated;
    });
  }

  function updateFullNote(index: number, value: string) {
    setNotes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], fullNote: value };
      return updated;
    });
  }

  function removeNote(index: number) {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  }

  function downloadCsv() {
    const headers = [
      "Event IDs",
      "Event Name",
      "Date",
      "Building",
      "Locations",
      "Account Number",
      "Reservation Number",
      "Venue Label",
      "Setup Time",
      "Setup Instructions",
      "Breakdown Time",
      "Full Note",
      "Warnings",
    ];

    const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;

    const rows = notes.map((n) => [
      escape(n.eventIds.join("; ")),
      escape(n.normalizedName),
      escape(n.date),
      escape(n.building),
      escape(n.locations.join("; ")),
      escape(n.accountNumber),
      escape(n.reservationNumber),
      escape(n.venueLabel),
      escape(n.setupTimeLine),
      escape(n.setupInstructions),
      escape(n.breakdownTimeLine),
      escape(n.fullNote),
      escape(n.warnings.join("; ")),
    ]);

    const csv = [headers.map(escape).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `internal-event-notes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSubmit() {
    if (!confirm(`This will update ${notes.length} event(s) in Coursedog. Continue?`)) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const resp = await fetch("/api/submit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: notes.map((n) => ({
            eventIds: n.eventIds,
            fullNote: n.fullNote,
          })),
        }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        throw new Error(result.error || "Failed to submit notes");
      }

      setSubmitResult(result.message);
      sessionStorage.removeItem("generatedNotes");
    } catch (err) {
      setSubmitResult(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (submitResult && !submitResult.startsWith("Error")) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="border-b bg-white px-6 py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">
              Coursedog Event Notes
            </h1>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4">
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Notes Submitted</h2>
            <p className="text-gray-600">{submitResult}</p>
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Back to Home
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/upload")}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              &larr; Re-upload
            </button>
            <h1 className="text-lg font-semibold text-gray-900">
              Review Generated Notes ({notes.length})
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadCsv}
              disabled={notes.length === 0}
              className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Download CSV
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || notes.length === 0}
              className="rounded-md bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : `Submit All to Coursedog`}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        {submitResult && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{submitResult}</p>
          </div>
        )}

        <div className="space-y-4">
          {notes.map((note, i) => (
            <div
              key={`${note.eventIds.join("-")}-${i}`}
              className="rounded-lg border bg-white shadow-sm"
            >
              {/* Summary row */}
              <div
                className="flex cursor-pointer items-center justify-between px-5 py-4"
                onClick={() =>
                  setExpandedIndex(expandedIndex === i ? null : i)
                }
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900">
                      {note.normalizedName}
                    </h3>
                    {note.warnings.length > 0 && (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        {note.warnings.length} warning{note.warnings.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {note.date} &middot; {note.building} &middot;{" "}
                    {note.locations.join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNote(i);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    title="Remove this note"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <svg
                    className={`h-5 w-5 text-gray-400 transition-transform ${expandedIndex === i ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedIndex === i && (
                <div className="border-t px-5 py-4 space-y-4">
                  {/* Warnings */}
                  {note.warnings.length > 0 && (
                    <div className="rounded-md bg-amber-50 p-3">
                      <p className="text-xs font-medium text-amber-800 mb-1">Warnings:</p>
                      {note.warnings.map((w, wi) => (
                        <p key={wi} className="text-xs text-amber-700">
                          &bull; {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Editable fields */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={note.accountNumber}
                        onChange={(e) => updateNote(i, "accountNumber", e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Reservation Number
                      </label>
                      <input
                        type="text"
                        value={note.reservationNumber}
                        onChange={(e) => updateNote(i, "reservationNumber", e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Venue Label
                      </label>
                      <input
                        type="text"
                        value={note.venueLabel}
                        onChange={(e) => updateNote(i, "venueLabel", e.target.value)}
                        className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Event IDs
                      </label>
                      <p className="px-2 py-1.5 text-sm text-gray-600 font-mono">
                        {note.eventIds.join(", ")}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Setup Time
                    </label>
                    <input
                      type="text"
                      value={note.setupTimeLine}
                      onChange={(e) => updateNote(i, "setupTimeLine", e.target.value)}
                      className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Setup Instructions (furniture details)
                    </label>
                    <textarea
                      value={note.setupInstructions}
                      onChange={(e) => updateNote(i, "setupInstructions", e.target.value)}
                      rows={3}
                      className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
                      placeholder="e.g. 5 round tables with 5 chairs each..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Breakdown Time
                    </label>
                    <input
                      type="text"
                      value={note.breakdownTimeLine}
                      onChange={(e) => updateNote(i, "breakdownTimeLine", e.target.value)}
                      className="w-full rounded border px-2 py-1.5 text-sm text-gray-900"
                    />
                  </div>

                  {/* Full note preview */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Full Note (editable preview — this is what gets saved to Coursedog)
                    </label>
                    <textarea
                      value={note.fullNote}
                      onChange={(e) => updateFullNote(i, e.target.value)}
                      rows={8}
                      className="w-full rounded border bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
