import type { CommitSummary, ChangedFile } from "@/types/analysis";

interface CommitListProps {
  commits: CommitSummary[];
  files: ChangedFile[];
}

const FILE_STATUS_COLOR: Record<string, string> = {
  added: "text-green-400 bg-green-500/10",
  modified: "text-amber-400 bg-amber-500/10",
  removed: "text-red-400 bg-red-500/10",
  renamed: "text-blue-400 bg-blue-500/10",
};

const FILE_STATUS_LABEL: Record<string, string> = {
  added: "A",
  modified: "M",
  removed: "D",
  renamed: "R",
};

export default function CommitList({ commits, files }: CommitListProps) {
  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
          <div className="text-xl font-bold text-slate-200">{commits.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Commits</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
          <div className="text-xl font-bold text-green-400">+{totalAdditions}</div>
          <div className="text-xs text-slate-500 mt-0.5">Lines added</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
          <div className="text-xl font-bold text-red-400">−{totalDeletions}</div>
          <div className="text-xs text-slate-500 mt-0.5">Lines removed</div>
        </div>
      </div>

      {/* Changed files */}
      {files.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Changed Files ({files.length})
          </h4>
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
            {files.map((file) => (
              <div
                key={file.filename}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800/60 transition-colors"
              >
                <span
                  className={`text-xs font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 ${FILE_STATUS_COLOR[file.status]}`}
                >
                  {FILE_STATUS_LABEL[file.status]}
                </span>
                <code className="text-xs font-mono text-slate-300 flex-1 truncate">
                  {file.filename}
                </code>
                <span className="text-xs text-green-400 shrink-0">+{file.additions}</span>
                <span className="text-xs text-red-400 shrink-0">−{file.deletions}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commits */}
      {commits.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Recent Commits
          </h4>
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {commits.map((commit) => (
              <div
                key={commit.sha}
                className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-slate-600/50 transition-colors"
              >
                <code className="text-xs font-mono text-blue-400 shrink-0 mt-0.5 w-14">
                  {commit.sha}
                </code>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{commit.message}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {commit.author} ·{" "}
                    {new Date(commit.date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                {commit.url && (
                  <a
                    href={commit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 mt-0.5 text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
