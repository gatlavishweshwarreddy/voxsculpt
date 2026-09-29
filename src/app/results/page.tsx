"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReleaseReport } from "@/types/analysis";
import ScoreGauge from "@/components/ScoreGauge";
import BreakingChangePanel from "@/components/BreakingChangePanel";
import TestCoveragePanel from "@/components/TestCoveragePanel";
import CompliancePanel from "@/components/CompliancePanel";
import CommitList from "@/components/CommitList";

type Tab = "overview" | "breaking" | "coverage" | "compliance" | "commits";

const TABS: { id: Tab; label: string; count?: (r: ReleaseReport) => number }[] = [
  { id: "overview", label: "Overview" },
  { id: "breaking", label: "Breaking Changes", count: (r) => r.breakingChanges.length },
  { id: "coverage", label: "Test Gaps", count: (r) => r.testCoverageGaps.length },
  { id: "compliance", label: "Compliance", count: (r) => r.complianceChecks.filter(c => c.status !== "na").length },
  { id: "commits", label: "Commits", count: (r) => r.rawCommits.length },
];

function getBadgeColor(count: number, tab: Tab): string {
  if (tab === "breaking" && count > 0) return "bg-red-500/20 text-red-300";
  if (tab === "coverage" && count > 0) return "bg-amber-500/20 text-amber-300";
  return "bg-slate-700 text-slate-400";
}

export default function ResultsPage() {
  const router = useRouter();
  const [report, setReport] = useState<ReleaseReport | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  useEffect(() => {
    const stored = sessionStorage.getItem("releaseReport");
    if (!stored) {
      router.replace("/");
      return;
    }
    try {
      setReport(JSON.parse(stored));
    } catch {
      router.replace("/");
    }
  }, [router]);

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading report…
        </div>
      </div>
    );
  }

  const recColors = {
    SAFE: "border-green-500/40 bg-green-500/5",
    CAUTION: "border-amber-500/40 bg-amber-500/5",
    UNSAFE: "border-red-500/40 bg-red-500/5",
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Nav */}
      <nav className="border-b border-slate-800/60 px-6 py-4 sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="font-semibold text-white text-sm">Release Safety Report</span>
          </div>

          {/* Repo info */}
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
            <a
              href={report.repo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-200 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="font-mono">{report.repo.owner}/{report.repo.repo}</span>
            </a>
            <span className="text-slate-700">·</span>
            <span className="font-mono text-slate-500">{report.repo.branch}</span>
          </div>

          <div className="text-xs text-slate-600">
            {new Date(report.generatedAt).toLocaleString()}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {/* ── Top hero band ─────────────────────────────────────────────── */}
        <div className={`rounded-2xl border p-6 mb-8 ${recColors[report.recommendation]}`}>
          <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 items-center">
            {/* Gauge */}
            <div className="flex justify-center lg:justify-start">
              <div className="w-64">
                <ScoreGauge report={report} />
              </div>
            </div>

            {/* Repo + quick stats */}
            <div className="space-y-5">
              {/* Repo header */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <a href={report.repo.url} target="_blank" rel="noopener noreferrer"
                    className="text-xl font-bold text-white hover:text-blue-300 transition-colors">
                    {report.repo.owner}/{report.repo.repo}
                  </a>
                  {report.repo.language && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600/50">
                      {report.repo.language}
                    </span>
                  )}
                </div>
                {report.repo.description && (
                  <p className="text-sm text-slate-400">{report.repo.description}</p>
                )}
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: "Breaking Changes",
                    value: report.breakingChanges.length,
                    color: report.breakingChanges.length > 0 ? "text-red-400" : "text-green-400",
                    icon: "⚡",
                  },
                  {
                    label: "Test Gaps",
                    value: report.testCoverageGaps.length,
                    color: report.testCoverageGaps.length > 0 ? "text-amber-400" : "text-green-400",
                    icon: "🧪",
                  },
                  {
                    label: "Compliance Issues",
                    value: report.complianceChecks.filter((c) => c.status === "fail" || c.status === "warning").length,
                    color: "text-slate-300",
                    icon: "📋",
                  },
                  {
                    label: "Files Changed",
                    value: report.changedFiles.length,
                    color: "text-slate-300",
                    icon: "📁",
                  },
                ].map((stat) => (
                  <div key={stat.label} className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/50">
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Last commit */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Last commit:{" "}
                <code className="font-mono text-slate-400">{report.repo.lastCommitSha}</code>
                <span className="truncate max-w-xs">{report.repo.lastCommitMessage}</span>
                <span>· {new Date(report.repo.lastCommitDate).toLocaleDateString()}</span>
              </div>

              {/* Analysis errors */}
              {report.analysisErrors.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300">
                  ⚠ Partial results — some API calls failed: {report.analysisErrors.join("; ")}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="border-b border-slate-800 mb-6">
          <div className="flex gap-1 overflow-x-auto pb-px">
            {TABS.map((tab) => {
              const count = tab.count?.(report);
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "border-blue-500 text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600"
                  }`}
                >
                  {tab.label}
                  {count !== undefined && count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${getBadgeColor(count, tab.id)}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <div className="pb-12">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Breaking changes preview */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Breaking Changes
                  <span className="ml-auto text-xs text-slate-600">{report.breakingChanges.length} found</span>
                </h2>
                <BreakingChangePanel changes={report.breakingChanges.slice(0, 3)} />
                {report.breakingChanges.length > 3 && (
                  <button onClick={() => setActiveTab("breaking")} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
                    View all {report.breakingChanges.length} →
                  </button>
                )}
              </div>

              {/* Test coverage preview */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Test Coverage Gaps
                  <span className="ml-auto text-xs text-slate-600">{report.testCoverageGaps.length} found</span>
                </h2>
                <TestCoveragePanel gaps={report.testCoverageGaps.slice(0, 3)} />
                {report.testCoverageGaps.length > 3 && (
                  <button onClick={() => setActiveTab("coverage")} className="mt-3 text-xs text-blue-400 hover:text-blue-300">
                    View all {report.testCoverageGaps.length} →
                  </button>
                )}
              </div>

              {/* Compliance preview */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  SOC2 / ITIL Compliance
                </h2>
                <CompliancePanel checks={report.complianceChecks} />
              </div>

              {/* Commits */}
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Changeset
                </h2>
                <CommitList commits={report.rawCommits.slice(0, 5)} files={report.changedFiles} />
              </div>
            </div>
          )}

          {activeTab === "breaking" && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-slate-200 mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                All Breaking Changes ({report.breakingChanges.length})
              </h2>
              <BreakingChangePanel changes={report.breakingChanges} />
            </div>
          )}

          {activeTab === "coverage" && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-slate-200 mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                All Test Coverage Gaps ({report.testCoverageGaps.length})
              </h2>
              <TestCoveragePanel gaps={report.testCoverageGaps} />
            </div>
          )}

          {activeTab === "compliance" && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-slate-200 mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                SOC2 / ITIL Compliance ({report.complianceChecks.length} checks)
              </h2>
              <CompliancePanel checks={report.complianceChecks} />
            </div>
          )}

          {activeTab === "commits" && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-base font-semibold text-slate-200 mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Full Changeset
              </h2>
              <CommitList commits={report.rawCommits} files={report.changedFiles} />
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-800/60 py-5 text-center text-xs text-slate-600">
        Bob&apos;s Release Pilot · IBM Bob Hackathon 2.0 · {new Date(report.generatedAt).toLocaleString()}
      </footer>
    </div>
  );
}
