import type { TestCoverageGap } from "@/types/analysis";

const SEVERITY_BG: Record<string, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-amber-500",
  low: "border-l-blue-400",
  info: "border-l-slate-500",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
  high: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  low: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  info: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

interface TestCoveragePanelProps {
  gaps: TestCoverageGap[];
}

export default function TestCoveragePanel({ gaps }: TestCoveragePanelProps) {
  if (gaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-slate-400">No test coverage gaps detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gaps.map((gap) => (
        <div
          key={gap.id}
          className={`p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 border-l-4 ${SEVERITY_BG[gap.severity]}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SEVERITY_BADGE[gap.severity]}`}>
              {gap.severity.toUpperCase()}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/70 text-slate-400 border border-slate-600/50">
              {gap.area}
            </span>
          </div>

          <p className="text-sm font-medium text-slate-200 mb-1.5">{gap.description}</p>

          {gap.files.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {gap.files.map((f) => (
                <code key={f} className="text-xs px-1.5 py-0.5 rounded bg-slate-900/60 border border-slate-700/50 text-slate-400 font-mono">
                  {f.split("/").slice(-2).join("/")}
                </code>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 mt-2 p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/30">
            <svg className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-blue-300 leading-relaxed">{gap.suggestion}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
