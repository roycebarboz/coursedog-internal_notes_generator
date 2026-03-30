"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Papa from "papaparse";

export default function UploadPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const processFile = useCallback(
    async (file: File) => {
      setError("");
      setProcessing(true);
      setStatusMsg("Parsing CSV...");

      try {
        const text = await file.text();

        // Parse CSV with PapaParse
        const parsed = Papa.parse<Record<string, string>>(text, {
          header: true,
          skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
          setError(`CSV parsing error: ${parsed.errors[0].message}`);
          setProcessing(false);
          return;
        }

        const csvData = parsed.data;
        if (csvData.length === 0) {
          setError("CSV file is empty.");
          setProcessing(false);
          return;
        }

        setStatusMsg(
          `Parsed ${csvData.length} rows. Generating notes from Coursedog...`
        );

        // Send to API
        const resp = await fetch("/api/generate-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvData }),
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body.error || `Server error: ${resp.status}`);
        }

        const result = await resp.json();

        if (!result.notes || result.notes.length === 0) {
          setError(
            result.message ||
              "No events with Facilities Request = Yes found in this CSV."
          );
          setProcessing(false);
          return;
        }

        // Store notes in sessionStorage and navigate to review page
        sessionStorage.setItem(
          "generatedNotes",
          JSON.stringify(result.notes)
        );
        router.push("/review");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
        setProcessing(false);
      }
    },
    [router]
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      processFile(file);
    } else {
      setError("Please upload a .csv file.");
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-lg font-semibold text-gray-900 hover:text-blue-600"
          >
            &larr; Coursedog Event Notes
          </button>
          <span className="text-sm text-gray-600">{session.user?.email}</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-10 gap-8">

        {/* Upload zone */}
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Upload Event CSV
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Upload the CSV export from Coursedog. Notes will be generated for
              events where Facilities Request = Yes.
            </p>
          </div>

          {processing ? (
            <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-12 text-center">
              <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="text-sm font-medium text-blue-700">{statusMsg}</p>
            </div>
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-white hover:border-gray-400"
              }`}
            >
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                />
              </svg>
              <p className="mt-4 text-sm text-gray-600">
                Drag & drop your CSV file here, or{" "}
                <label className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                  browse
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="mt-1 text-xs text-gray-400">CSV files only</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Expected columns reference — transposed table, fully visible */}
        {(() => {
          const cols = [
            { col: "Event Name",                              type: "Text",           example: "Setup: Annual Gala  or  Annual Gala" },
            { col: "Date & Time",                             type: "Date range",     example: "Mar 19, 2026 7:30 AM - 6:00 PM" },
            { col: "Location",                                type: "Text",           example: "UCC 106 (The Gallery)" },
            { col: "Internal Events Notes  (General Event)",  type: "Text (optional)",example: "10 round tables, 80 chairs" },
            { col: "Event ID",                                type: "ID",             example: "abc123" },
            { col: "Facilities Request ? (General Event)",    type: "Yes / No / –",  example: 'Only "Yes" rows are processed' },
          ];
          return (
            <div className="w-full max-w-6xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Expected CSV Columns (in order)
              </p>
              <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
                <table className="w-full table-fixed border-collapse">
                  <colgroup>
                    <col className="w-28" />
                    {cols.map((_, i) => <col key={i} />)}
                  </colgroup>
                  <tbody>
                    {/* Row 1 — Column Name */}
                    <tr className="border-b border-gray-200">
                      <td className="bg-gray-100 px-3 py-2 font-semibold text-gray-600 border-r border-gray-200 align-top whitespace-nowrap">
                        Column Name
                      </td>
                      {cols.map(({ col }, i) => (
                        <td key={col} className="bg-white px-3 py-2 border-r border-gray-200 align-top last:border-r-0">
                          <span className="text-gray-400 mr-1">{i + 1}.</span>
                          <span className="font-mono font-semibold text-gray-800 break-words">{col}</span>
                        </td>
                      ))}
                    </tr>
                    {/* Row 2 — Description */}
                    <tr className="border-b border-gray-200">
                      <td className="bg-gray-100 px-3 py-2 font-semibold text-gray-600 border-r border-gray-200 align-top whitespace-nowrap">
                        Description
                      </td>
                      {cols.map(({ col, type }) => (
                        <td key={col} className="bg-white px-3 py-2 border-r border-gray-200 align-top last:border-r-0">
                          <span className="inline-block rounded bg-blue-50 text-blue-600 px-1.5 py-0.5 font-medium">{type}</span>
                        </td>
                      ))}
                    </tr>
                    {/* Row 3 — Example */}
                    <tr>
                      <td className="bg-gray-100 px-3 py-2 font-semibold text-gray-600 border-r border-gray-200 align-top whitespace-nowrap">
                        Example
                      </td>
                      {cols.map(({ col, example }) => (
                        <td key={col} className="bg-white px-3 py-2 border-r border-gray-200 text-gray-500 align-top last:border-r-0 break-words">
                          {example}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

      </main>
    </div>
  );
}
