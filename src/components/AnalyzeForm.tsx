"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AnalyzeRequest } from "@/types/analysis";

export default function AnalyzeForm() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [headBranch, setHeadBranch] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidUrl = (url: string) =>
    /^https?:\/\/(github|gitlab)\.com\/.+\/.+/.test(url.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUrl(repoUrl)) {
      setError("Please enter a valid GitHub or GitLab repository URL.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const payload: AnalyzeRequest = {
        repoUrl: repoUrl.trim(),
        ...(baseBranch && { baseBranch: baseBranch.trim() }),
        ...(headBranch && { headBranch: headBranch.trim() }),
        ...(githubToken && { githubToken: githubToken.trim() }),
      };

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Analysis failed.");
        setLoading(false);
        return;
      }

      // Store report in sessionStorage and navigate
      sessionStorage.setItem("releaseReport", JSON.stringify(data.report));
      router.push("/results");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  const examples = [
    "https://github.com/vercel/next.js",
    "https://github.com/facebook/react",
    "https://github.com/tailwindlabs/tailwindcss",
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Repo URL */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Repository URL
        </label>
        <input
          type="url"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors text-base"
          required
          disabled={loading}
        />
        {/* Quick examples */}
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Try:</span>
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setRepoUrl(ex)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors underline underline-offset-2"
            >
              {ex.replace("https://github.com/", "")}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Advanced options
      </button>

      {showAdvanced && (
        <div className="space-y-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Base branch (optional)
              </label>
              <input
                type="text"
                value={baseBranch}
                onChange={(e) => setBaseBranch(e.target.value)}
                placeholder="main"
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Head branch (optional)
              </label>
              <input
                type="text"
                value={headBranch}
                onChange={(e) => setHeadBranch(e.target.value)}
                placeholder="release/v2.0"
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                disabled={loading}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              GitHub/GitLab API Token (optional — increases rate limit)
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_... or glpat-..."
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-slate-500">
              Token stays in your browser and is never stored.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-950/50 border border-red-800/60 rounded-xl text-sm text-red-300">
          <svg className="w-5 h-5 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !repoUrl}
        className="w-full py-3.5 px-6 rounded-xl font-semibold text-base bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white transition-all duration-200 flex items-center justify-center gap-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Analyzing repository…
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Analyze Release Safety
          </>
        )}
      </button>
    </form>
  );
}
