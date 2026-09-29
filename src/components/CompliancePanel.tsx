import type { ReactNode } from "react";
import type { ComplianceCheck } from "@/types/analysis";

const STATUS_STYLES: Record<ComplianceCheck["status"], { badge: string; icon: ReactNode }> = {
  pass: {
    badge: "bg-green-500/15 text-green-300 border-green-500/30",
    icon: (
      <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  warning: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    icon: (
      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  fail: {
    badge: "bg-red-500/15 text-red-300 border-red-500/30",
    icon: (
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  na: {
    badge: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    icon: (
      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
      </svg>
    ),
  },
};

const FRAMEWORK_COLOR: Record<ComplianceCheck["framework"], string> = {
  SOC2: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  ITIL: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  general: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

interface CompliancePanelProps {
  checks: ComplianceCheck[];
}

export default function CompliancePanel({ checks }: CompliancePanelProps) {
  const groups: Record<string, ComplianceCheck[]> = {};
  for (const check of checks) {
    const key = check.framework;
    if (!groups[key]) groups[key] = [];
    groups[key].push(check);
  }

  const counts = {
    pass: checks.filter((c) => c.status === "pass").length,
    warning: checks.filter((c) => c.status === "warning").length,
    fail: checks.filter((c) => c.status === "fail").length,
    na: checks.filter((c) => c.status === "na").length,
  };

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Passed", count: counts.pass, color: "text-green-400" },
          { label: "Warnings", count: counts.warning, color: "text-amber-400" },
          { label: "Failed", count: counts.fail, color: "text-red-400" },
          { label: "N/A", count: counts.na, color: "text-slate-500" },
        ].map(({ label, count, color }) => (
          <div key={label} className="text-center p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className={`text-2xl font-bold ${color}`}>{count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Grouped checks */}
      {Object.entries(groups).map(([framework, items]) => (
        <div key={framework}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${FRAMEWORK_COLOR[framework as ComplianceCheck["framework"]]}`}>
              {framework}
            </span>
            <div className="flex-1 h-px bg-slate-700/50" />
          </div>
          <div className="space-y-2">
            {items.map((check) => {
              const style = STATUS_STYLES[check.status];
              return (
                <div key={check.id} className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{style.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-medium text-slate-200">{check.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${style.badge}`}>
                          {check.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{check.description}</p>
                      {check.evidence && (
                        <div className="mt-1.5 px-2 py-1 rounded bg-slate-900/50 border border-slate-700/40">
                          <code className="text-xs font-mono text-slate-400">{check.evidence}</code>
                        </div>
                      )}
                      {check.remediation && check.status !== "pass" && (
                        <div className="mt-2 flex items-start gap-1.5">
                          <svg className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <p className="text-xs text-blue-300">{check.remediation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
