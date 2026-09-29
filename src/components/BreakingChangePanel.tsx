import type { BreakingChange, Severity } from "@/types/analysis";

const SEVERITY_STYLES: Record<Severity, { badge: string; border: string; icon: string }> = {
  critical: {
    badge: "bg-red-500/15 text-red-300 border-red-500/30",
    border: "border-l-red-500",
    icon: "text-red-400",
  },
  high: {
    badge: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    border: "border-l-orange-500",
    icon: "text-orange-400",
  },
  medium: {
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    border: "border-l-amber-500",
    icon: "text-amber-400",
  },
  low: {
    badge: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    border: "border-l-blue-400",
    icon: "text-blue-400",
  },
  info: {
    badge: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    border: "border-l-slate-500",
    icon: "text-slate-400",
  },
};

const TYPE_LABELS: Record<BreakingChange["type"], string> = {
  api_signature: "API Change",
  dependency_major: "Dependency",
  removed_export: "Removed Export",
  schema_change: "Schema",
  config_change: "Config",
  env_var: "Env Var",
};

interface BreakingChangePanelProps {
  changes: BreakingChange[];
}

export default function BreakingChangePanel({ changes }: BreakingChangePanelProps) {
  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-sm text-slate-400">No breaking changes detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {changes.map((change) => {
        const style = SEVERITY_STYLES[change.severity];
        return (
          <div
            key={change.id}
            className={`p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 border-l-4 ${style.border}`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.badge}`}>
                  {change.severity.toUpperCase()}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/70 text-slate-400 border border-slate-600/50">
                  {TYPE_LABELS[change.type]}
                </span>
              </div>
            </div>

            <h4 className="text-sm font-semibold text-slate-200 mb-1">{change.title}</h4>
            <p className="text-xs text-slate-400 leading-relaxed mb-2">{change.description}</p>

            {change.file !== "commit message" && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <code className="font-mono text-slate-400">{change.file}</code>
              </div>
            )}

            {change.evidence && (
              <div className="mt-2 p-2 rounded-lg bg-slate-900/60 border border-slate-700/40">
                <code className="text-xs font-mono text-slate-400 break-all">{change.evidence}</code>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
