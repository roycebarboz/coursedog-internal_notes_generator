"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppHeader from "@/app/components/AppHeader";

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
  additionalNotes: string;
  fullNote: string;
  warnings: string[];
}

export default function ReviewPage() {
  const router = useRouter();
  const [notes, setNotes] = useState<NoteData[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("generatedNotes");
    if (!stored) {
      const hasCsv = !!sessionStorage.getItem("parsedCsvData");
      router.push(hasCsv ? "/filter" : "/upload");
      return;
    }

    try {
      setNotes(JSON.parse(stored));
    } catch {
      router.push("/filter");
    }
  }, [router]);

  function updateNote(index: number, field: keyof NoteData, value: string) {
    setNotes((prev) => {
      const updated = [...prev];
      const note = { ...updated[index], [field]: value };

      if (
        ["accountNumber", "reservationNumber", "venueLabel", "setupTimeLine", "setupInstructions", "breakdownTimeLine", "additionalNotes"].includes(field)
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
        if (note.additionalNotes) {
          lines.push("");
          lines.push("");
          lines.push(note.additionalNotes);
        }
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
      "Event IDs", "Event Name", "Date", "Building", "Locations",
      "Account Number", "Reservation Number", "Venue Label",
      "Setup Time", "Setup Instructions", "Breakdown Time",
      "Additional Notes", "Full Note", "Warnings",
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
      escape(n.additionalNotes),
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

  const totalWarnings = notes.reduce((sum, n) => sum + n.warnings.length, 0);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader
        currentStep={2}
        onBack={() => router.push("/filter")}
        backLabel="Back to Filter"
      />

      {/* Sticky action bar */}
      <div className="sticky top-14 z-10 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Review Generated Notes
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 tabular-nums">
                {notes.length}
              </span>
            </h2>
            {totalWarnings > 0 && (
              <p className="mt-0.5 text-xs text-amber-700 font-medium">
                {totalWarnings} warning{totalWarnings > 1 ? "s" : ""} across notes — review before downloading.
              </p>
            )}
          </div>
          <button
            onClick={downloadCsv}
            disabled={notes.length === 0}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            Download CSV
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="space-y-3">
          {notes.map((note, i) => {
            const isExpanded = expandedIndex === i;
            return (
              <div
                key={`${note.eventIds.join("-")}-${i}`}
                className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Summary row */}
                <div
                  className={`flex cursor-pointer items-center justify-between px-5 py-4 transition-colors ${
                    isExpanded ? "bg-gray-50" : "hover:bg-gray-50"
                  }`}
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                >
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {note.normalizedName}
                      </h3>
                      {note.warnings.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 shrink-0">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                          </svg>
                          {note.warnings.length} warning{note.warnings.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500 truncate">
                      {note.date}
                      {note.building && <> &middot; {note.building}</>}
                      {note.locations.length > 0 && <> &middot; {note.locations.join(", ")}</>}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400 truncate">
                      Setup: <span className="text-gray-500">{note.setupTimeLine || "—"}</span>
                      {note.breakdownTimeLine && (
                        <> &middot; Breakdown: <span className="text-gray-500">{note.breakdownTimeLine}</span></>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNote(i);
                      }}
                      className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Remove this note"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <svg
                      className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
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
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-5 space-y-5 bg-white">
                    {/* Warnings */}
                    {note.warnings.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-semibold text-amber-800 mb-2">
                          Warnings — review before downloading:
                        </p>
                        <ul className="space-y-1">
                          {note.warnings.map((w, wi) => (
                            <li key={wi} className="flex items-start gap-1.5 text-xs text-amber-700">
                              <span className="mt-0.5 shrink-0">&bull;</span>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Editable fields — 2 col grid */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                        Event Details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={note.accountNumber}
                            onChange={(e) => updateNote(i, "accountNumber", e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Reservation Number
                          </label>
                          <input
                            type="text"
                            value={note.reservationNumber}
                            onChange={(e) => updateNote(i, "reservationNumber", e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Venue Label
                          </label>
                          <input
                            type="text"
                            value={note.venueLabel}
                            onChange={(e) => updateNote(i, "venueLabel", e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Event IDs
                          </label>
                          <p className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-500 font-mono">
                            {note.eventIds.join(", ")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Schedule fields */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                        Schedule
                      </p>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Setup Time
                          </label>
                          <input
                            type="text"
                            value={note.setupTimeLine}
                            onChange={(e) => updateNote(i, "setupTimeLine", e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Setup Instructions <span className="text-gray-400 font-normal">(furniture details)</span>
                          </label>
                          <textarea
                            value={note.setupInstructions}
                            onChange={(e) => updateNote(i, "setupInstructions", e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-y"
                            placeholder="e.g. 5 round tables with 5 chairs each..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1.5">
                            Breakdown Time
                          </label>
                          <input
                            type="text"
                            value={note.breakdownTimeLine}
                            onChange={(e) => updateNote(i, "breakdownTimeLine", e.target.value)}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                          />
                        </div>
                        {note.additionalNotes && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">
                              Additional Notes <span className="text-gray-400 font-normal">(shown after breakdown)</span>
                            </label>
                            <textarea
                              value={note.additionalNotes}
                              onChange={(e) => updateNote(i, "additionalNotes", e.target.value)}
                              rows={3}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-y"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Full note preview */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Full Note Preview
                        </label>
                      </div>
                      <textarea
                        value={note.fullNote}
                        onChange={(e) => updateFullNote(i, e.target.value)}
                        rows={9}
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition resize-y"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
