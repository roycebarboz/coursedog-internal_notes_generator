"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Papa from "papaparse";
import AppHeader from "@/app/components/AppHeader";

export default function UploadPage() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [refOpen, setRefOpen] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      setError("");
      setProcessing(true);
      setStatusMsg("Parsing CSV...");

      try {
        const text = await file.text();

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

        setStatusMsg(`Parsed ${csvData.length} rows. Loading event filter...`);

        sessionStorage.setItem("parsedCsvData", JSON.stringify(csvData));
        router.push("/filter");
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

  const cols = [
    { col: "Event Name",                             type: "Text",            example: "Setup: Annual Gala  or  Annual Gala" },
    { col: "Date & Time",                            type: "Date range",      example: "Mar 19, 2026 7:30 AM - 6:00 PM" },
    { col: "Location",                               type: "Text",            example: "UCC 106 (The Gallery)" },
    { col: "Meeting Type",                           type: "Text",            example: 'Only "Main Meeting" rows are processed' },
    { col: "Internal Events Notes (General Event)",  type: "Text (optional)", example: "10 round tables, 80 chairs" },
    { col: "Event ID",                               type: "ID",              example: "abc123" },
    { col: "Facilities Request ? (General Event)",   type: "Yes / No / –",   example: 'Only "Yes" rows are processed' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader
        currentStep={0}
        onBack={() => router.push("/")}
        backLabel="Home"
      />

      <main className="flex flex-1 flex-col items-center px-4 py-10 gap-8">

        {/* Page title */}
        <div className="text-center w-full max-w-lg">
          <h2 className="text-2xl font-bold text-gray-900">Upload Event CSV</h2>
          <p className="mt-2 text-sm text-gray-500">
            Export events from Coursedog, then drop the file below to get started.
          </p>
        </div>

        {/* Drop zone */}
        <div className="w-full max-w-lg">
          {processing ? (
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-14 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
              <p className="text-sm font-semibold text-blue-700">{statusMsg}</p>
              <p className="mt-1 text-xs text-blue-500">This may take a moment…</p>
            </div>
          ) : (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-14 text-center transition-all cursor-pointer ${
                dragActive
                  ? "border-blue-500 bg-blue-50 scale-[1.01]"
                  : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"
              }`}
            >
              <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                dragActive ? "bg-blue-100" : "bg-gray-100"
              }`}>
                <svg
                  className={`h-7 w-7 transition-colors ${dragActive ? "text-blue-600" : "text-gray-400"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">
                Drag &amp; drop your CSV here
              </p>
              <p className="mt-1 text-sm text-gray-500">
                or{" "}
                <span className="text-blue-600 font-medium hover:text-blue-700">
                  browse to select a file
                </span>
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
                .csv files only
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-red-50 px-4 py-3">
              <svg
                className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* CSV column reference — collapsible */}
        <div className="w-full max-w-6xl">
          <button
            onClick={() => setRefOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
              </svg>
              Expected CSV columns reference
            </span>
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform ${refOpen ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {refOpen && (
            <div className="mt-2 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <colgroup>
                    <col className="w-24" />
                    {cols.map((_, i) => <col key={i} />)}
                  </colgroup>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="bg-gray-50 px-4 py-3 font-semibold text-gray-500 border-r border-gray-100 align-top whitespace-nowrap">
                        Column
                      </td>
                      {cols.map(({ col }, i) => (
                        <td key={col} className="px-3 py-3 border-r border-gray-100 align-top last:border-r-0">
                          <span className="text-gray-300 mr-1 font-mono">{i + 1}.</span>
                          <span className="font-semibold text-gray-800 break-words">{col}</span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="bg-gray-50 px-4 py-3 font-semibold text-gray-500 border-r border-gray-100 align-top whitespace-nowrap">
                        Type
                      </td>
                      {cols.map(({ col, type }) => (
                        <td key={col} className="px-3 py-3 border-r border-gray-100 align-top last:border-r-0">
                          <span className="inline-block rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 font-medium">{type}</span>
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="bg-gray-50 px-4 py-3 font-semibold text-gray-500 border-r border-gray-100 align-top whitespace-nowrap">
                        Example
                      </td>
                      {cols.map(({ col, example }) => (
                        <td key={col} className="px-3 py-3 border-r border-gray-100 text-gray-500 align-top last:border-r-0 break-words">
                          {example}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
