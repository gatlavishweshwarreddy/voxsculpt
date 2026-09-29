// Core types for Bob's Release Pilot analysis engine

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type RepoProvider = "github" | "gitlab" | "unknown";

export interface RepoInfo {
  provider: RepoProvider;
  owner: string;
  repo: string;
  branch: string;
  url: string;
  defaultBranch: string;
  description: string | null;
  language: string | null;
  starCount: number;
  lastCommitSha: string;
  lastCommitMessage: string;
  lastCommitDate: string;
}

export interface BreakingChange {
  id: string;
  type:
    | "api_signature"
    | "dependency_major"
    | "removed_export"
    | "schema_change"
    | "config_change"
    | "env_var";
  severity: Severity;
  title: string;
  description: string;
  file: string;
  evidence: string;
  affectedConsumers: string[];
}

export interface TestCoverageGap {
  id: string;
  severity: Severity;
  area: string;
  description: string;
  files: string[];
  suggestion: string;
}

export interface ComplianceCheck {
  id: string;
  framework: "SOC2" | "ITIL" | "general";
  category: string;
  status: "pass" | "fail" | "warning" | "na";
  title: string;
  description: string;
  evidence: string | null;
  remediation: string | null;
}

export interface ScoreDimension {
  name: string;
  score: number; // 0–100
  weight: number; // decimal, sum = 1
  label: string;
}

export interface ReleaseReport {
  id: string;
  generatedAt: string;
  repo: RepoInfo;
  safetyScore: number; // 0–100
  recommendation: "SAFE" | "UNSAFE" | "CAUTION";
  summary: string;
  dimensions: ScoreDimension[];
  breakingChanges: BreakingChange[];
  testCoverageGaps: TestCoverageGap[];
  complianceChecks: ComplianceCheck[];
  rawCommits: CommitSummary[];
  changedFiles: ChangedFile[];
  analysisErrors: string[];
}

export interface CommitSummary {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}

export interface ChangedFile {
  filename: string;
  status: "added" | "modified" | "removed" | "renamed";
  additions: number;
  deletions: number;
  patch?: string;
}

export interface AnalyzeRequest {
  repoUrl: string;
  baseBranch?: string;
  headBranch?: string;
  githubToken?: string;
  gitlabToken?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  report?: ReleaseReport;
  error?: string;
}
