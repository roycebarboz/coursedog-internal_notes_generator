"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { COL } from "@/lib/csv-parser";
import AppHeader from "@/app/components/AppHeader";

const FACILITIES_COL = COL.FACILITIES;
const MEETING_TYPE_COL = COL.MEETING_TYPE;

interface FilterRow {
  originalIndex: number;
  raw: Record<string, string>;
}

export default function FilterPage() {
  const router = useRouter();

  const [allRawRows, setAllRawRows] = useState<Record<string, string>[]>([]);
  const [mainMeetingRows, setMainMeetingRows] = useState<FilterRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("parsedCsvData");
    if (!stored) {
      router.push("/upload");
      return;
    }

    let raw: Record<string, string>[];
    try {
      raw = JSON.parse(stored);
    } catch {
      router.push("/upload");
      return;
    }

    setAllRawRows(raw);

    const mmRows: FilterRow[] = [];
    const preSelected = new Set<number>();

    raw.forEach((row, idx) => {
      if ((row[MEETING_TYPE_COL] || "").trim().toLowerCase() !== "main meeting") return;
      mmRows.push({ originalIndex: idx, raw: row });
      if ((row[FACILITIES_COL] || "").trim() === "Yes") {
        preSelected.add(idx);
      }
    });

    setMainMeetingRows(mmRows);
    setSelected(preSelected);
  }, [router]);

  const allChecked =
    mainMeetingRows.length > 0 &&
    mainMeetingRows.every((r) => selected.has(r.originalIndex));

  function toggleSelectAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(mainMeetingRows.map((r) => r.originalIndex)));
    }
  }

  function toggleRow(idx: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  }

  function downloadCsv() {
    const headers = [
      COL.NAME,
      COL.DATE_TIME,
      COL.LOCATION,
      COL.MEETING_TYPE,
      COL.NOTES,
      COL.EVENT_ID,
      COL.FACILITIES,
      "Generate Setup?",
    ];

    const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;

    const rows = mainMeetingRows.map((r) => {
      const genSetup = selected.has(r.originalIndex) ? "Yes" : "No";
      return [
        escape(r.raw[COL.NAME] ?? ""),
        escape(r.raw[COL.DATE_TIME] ?? ""),
        escape(r.raw[COL.LOCATION] ?? ""),
        escape(r.raw[COL.MEETING_TYPE] ?? ""),
        escape(r.raw[COL.NOTES] ?? ""),
        escape(r.raw[COL.EVENT_ID] ?? ""),
        escape(r.raw[COL.FACILITIES] ?? ""),
        escape(genSetup),
      ].join(",");
    });

    const csv = [headers.map(escape).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "main-meeting-events.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const generateNotes = useCallback(async () => {
    setError("");
    setProcessing(true);

    const modifiedRows = allRawRows.map((row, idx) => {
      const isMM = (row[MEETING_TYPE_COL] || "").trim().toLowerCase() === "main meeting";
      if (!isMM) return row;
      return {
        ...row,
        [FACILITIES_COL]: selected.has(idx) ? "Yes" : "No",
      };
    });

    try {
      const resp = await fetch("/api/generate-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: modifiedRows }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || `Server error: ${resp.status}`);
      }

      const result = await resp.json();

      if (!result.notes || result.notes.length === 0) {
        setError(
          result.message ||
            "No events selected for setup. Check at least one event and try again."
        );
        setProcessing(false);
        return;
      }

      sessionStorage.setItem("generatedNotes", JSON.stringify(result.notes));
      router.push("/review");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setProcessing(false);
    }
  }, [allRawRows, selected, router]);

  const selectedCount = mainMeetingRows.filter((r) =>
    selected.has(r.originalIndex)
  ).length;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader
        currentStep={1}
        onBack={() => router.push("/upload")}
        backLabel="Back to Upload"
      />

      <main className="flex flex-1 flex-col px-4 py-6 gap-5 mx-auto w-full max-w-7xl">

        {/* Action bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Select Events for Setup Notes</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {mainMeetingRows.length === 0 ? (
                "No Main Meeting events found."
              ) : (
                <>
                  Showing{" "}
                  <span className="font-medium text-gray-700">{mainMeetingRows.length}</span> Main Meeting event{mainMeetingRows.length !== 1 ? "s" : ""} &mdash;{" "}
                  <span className="font-semibold text-blue-700">{selectedCount}</span> selected for setup note generation.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={downloadCsv}
              disabled={mainMeetingRows.length === 0}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Download CSV
            </button>
            <button
              onClick={generateNotes}
              disabled={processing || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {processing ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  Generate Notes
                  {selectedCount > 0 && (
                    <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-xs font-bold tabular-nums">
                      {selectedCount}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {processing && (
          <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-10 text-center">
            <div className="mx-auto mb-3 h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm font-semibold text-blue-700">
              Fetching Coursedog data and generating notes...
            </p>
            <p className="mt-1 text-xs text-blue-500">This may take up to 30 seconds.</p>
          </div>
        )}

        {/* Empty state */}
        {!processing && mainMeetingRows.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-14 text-center shadow-sm">
            <svg className="mx-auto h-10 w-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            <p className="text-gray-500 text-sm font-medium">No Main Meeting rows found in the uploaded CSV.</p>
            <p className="text-gray-400 text-xs mt-1">Make sure the CSV contains rows with Meeting Type = "Main Meeting".</p>
          </div>
        )}

        {/* Table */}
        {!processing && mainMeetingRows.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        title="Select all"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      Event Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      Date &amp; Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      Internal Notes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      Event ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap">
                      Facilities
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mainMeetingRows.map((r, i) => {
                    const isSelected = selected.has(r.originalIndex);
                    return (
                      <tr
                        key={r.originalIndex}
                        onClick={() => toggleRow(r.originalIndex)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors last:border-b-0 ${
                          isSelected
                            ? "bg-blue-50 hover:bg-blue-100"
                            : i % 2 === 0
                            ? "bg-white hover:bg-gray-50"
                            : "bg-gray-50/40 hover:bg-gray-100"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(r.originalIndex)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">
                          {r.raw[COL.NAME] || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {r.raw[COL.DATE_TIME] || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-xs">
                          {r.raw[COL.LOCATION] || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-400 max-w-xs truncate italic">
                          {r.raw[COL.NOTES] || <span className="not-italic text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                          {r.raw[COL.EVENT_ID] || "—"}
                        </td>
                        <td className="px-4 py-3">
                          {r.raw[FACILITIES_COL] === "Yes" ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                              Yes
                            </span>
                          ) : r.raw[FACILITIES_COL] === "No" ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
                              No
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">
                              {r.raw[FACILITIES_COL] || "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="border-t border-gray-100 bg-gray-50 px-5 py-2.5 text-xs text-gray-400">
              {selectedCount} of {mainMeetingRows.length} events selected &mdash; click a row to toggle selection
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
