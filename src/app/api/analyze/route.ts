import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { AnalyzeRequest, AnalyzeResponse, ReleaseReport } from "@/types/analysis";
import {
  detectProvider,
  parseRepoUrl,
  fetchGitHubRepoInfo,
  fetchGitHubCommits,
  fetchGitHubChangedFiles,
  fetchGitLabRepoInfo,
  fetchGitLabCommits,
  fetchGitLabChangedFiles,
} from "@/lib/repo-fetcher";
import { analyzeBreakingChanges } from "@/lib/breaking-changes";
import { analyzeTestCoverageGaps } from "@/lib/test-coverage";
import { runComplianceChecks } from "@/lib/compliance";
import { calculateSafetyScore, getRecommendation, generateSummary } from "@/lib/scorer";

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { repoUrl, baseBranch, headBranch, githubToken, gitlabToken } = body;

    if (!repoUrl) {
      return NextResponse.json<AnalyzeResponse>(
        { success: false, error: "Repository URL is required." },
        { status: 400 }
      );
    }

    const provider = detectProvider(repoUrl);
    if (provider === "unknown") {
      return NextResponse.json<AnalyzeResponse>(
        {
          success: false,
          error:
            "Unsupported repository URL. Please provide a GitHub or GitLab URL.",
        },
        { status: 400 }
      );
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json<AnalyzeResponse>(
        { success: false, error: "Could not parse repository URL. Expected format: https://github.com/owner/repo" },
        { status: 400 }
      );
    }

    const { owner, repo } = parsed;
    const errors: string[] = [];

    // ── Fetch repo info ────────────────────────────────────────────────────
    let repoInfo;
    try {
      repoInfo =
        provider === "github"
          ? await fetchGitHubRepoInfo(owner, repo, githubToken)
          : await fetchGitLabRepoInfo(owner, repo, gitlabToken);
    } catch (e) {
      return NextResponse.json<AnalyzeResponse>(
        { success: false, error: `Failed to fetch repository: ${(e as Error).message}` },
        { status: 422 }
      );
    }

    const head = headBranch || repoInfo.defaultBranch;

    // ── Fetch commits ──────────────────────────────────────────────────────
    let commits: import("@/types/analysis").CommitSummary[] = [];
    try {
      commits =
        provider === "github"
          ? await fetchGitHubCommits(owner, repo, head, githubToken, 25)
          : await fetchGitLabCommits(owner, repo, head, gitlabToken, 25);
    } catch (e) {
      errors.push(`Could not fetch commits: ${(e as Error).message}`);
    }

    // ── Fetch changed files ────────────────────────────────────────────────
    let changedFiles: import("@/types/analysis").ChangedFile[] = [];
    try {
      // For GitHub compare, we use oldest fetched commit SHA as base if no explicit base given
      const compareBase =
        baseBranch ??
        (commits.length >= 2 ? commits[commits.length - 1].sha : head);
      changedFiles =
        provider === "github"
          ? await fetchGitHubChangedFiles(owner, repo, compareBase, head, githubToken)
          : await fetchGitLabChangedFiles(owner, repo, compareBase, head, gitlabToken);
    } catch (e) {
      errors.push(`Could not fetch file diff: ${(e as Error).message}`);
    }

    // ── Run analysis engines ───────────────────────────────────────────────
    const breakingChanges = analyzeBreakingChanges(commits, changedFiles);
    const testCoverageGaps = analyzeTestCoverageGaps(changedFiles);
    const complianceChecks = runComplianceChecks(changedFiles, commits, repoInfo);
    const { score, dimensions } = calculateSafetyScore(
      breakingChanges,
      testCoverageGaps,
      complianceChecks,
      commits.length,
      changedFiles.length
    );
    const recommendation = getRecommendation(score, breakingChanges);
    const summary = generateSummary(
      score,
      recommendation,
      breakingChanges,
      testCoverageGaps,
      complianceChecks
    );

    const report: ReleaseReport = {
      id: randomUUID(),
      generatedAt: new Date().toISOString(),
      repo: repoInfo,
      safetyScore: score,
      recommendation,
      summary,
      dimensions,
      breakingChanges,
      testCoverageGaps,
      complianceChecks,
      rawCommits: commits,
      changedFiles,
      analysisErrors: errors,
    };

    return NextResponse.json<AnalyzeResponse>({ success: true, report });
  } catch (e) {
    console.error("[analyze] Unexpected error:", e);
    return NextResponse.json<AnalyzeResponse>(
      { success: false, error: `Unexpected error: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
