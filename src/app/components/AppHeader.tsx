"use client";

import { useRouter } from "next/navigation";

const STEPS = [
  { label: "Upload" },
  { label: "Filter" },
  { label: "Review" },
];

interface AppHeaderProps {
  /** 0 = Upload, 1 = Filter, 2 = Review. Omit to hide steps. */
  currentStep?: number;
  backLabel?: string;
  onBack?: () => void;
}

export default function AppHeader({
  currentStep,
  backLabel,
  onBack,
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-14">
        {/* Left: back nav or app name */}
        <div className="flex items-center gap-3 min-w-0">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors shrink-0"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              {backLabel ?? "Back"}
            </button>
          ) : (
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 shrink-0">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <span className="hidden sm:block">Event Notes</span>
            </button>
          )}
        </div>

        {/* Center: step indicator */}
        {currentStep !== undefined && (
          <div className="hidden sm:flex items-center gap-1">
            {STEPS.map((step, i) => {
              const isCompleted = i < currentStep;
              const isActive = i === currentStep;
              return (
                <div key={step.label} className="flex items-center gap-1">
                  <div
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : isCompleted
                        ? "text-green-700"
                        : "text-gray-400"
                    }`}
                  >
                    {isCompleted ? (
                      <svg
                        className="h-3.5 w-3.5 text-green-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2.5}
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    ) : (
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                          isActive ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                    )}
                    {step.label}
                  </div>
                  {i < STEPS.length - 1 && (
                    <svg
                      className="h-3.5 w-3.5 text-gray-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Right: spacer for layout balance */}
        <div className="min-w-0" />
      </div>
    </header>
  );
}
