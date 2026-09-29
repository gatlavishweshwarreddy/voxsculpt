import type {
  ReleaseReport,
  BreakingChange,
  TestCoverageGap,
  ComplianceCheck,
  ScoreDimension,
} from "@/types/analysis";

function severityWeight(sev: BreakingChange["severity"]): number {
  return { critical: 25, high: 15, medium: 8, low: 3, info: 1 }[sev] ?? 1;
}

function calcBreakingChangesScore(changes: BreakingChange[]): number {
  if (changes.length === 0) return 100;
  const penalty = changes.reduce((acc, c) => acc + severityWeight(c.severity), 0);
  return Math.max(0, 100 - penalty);
}

function calcTestCoverageScore(gaps: TestCoverageGap[]): number {
  if (gaps.length === 0) return 100;
  const penalty = gaps.reduce(
    (acc, g) => acc + severityWeight(g.severity as BreakingChange["severity"]),
    0
  );
  return Math.max(0, 100 - penalty);
}

function calcComplianceScore(checks: ComplianceCheck[]): number {
  const active = checks.filter((c) => c.status !== "na");
  if (active.length === 0) return 100;
  const passed = active.filter((c) => c.status === "pass").length;
  const warned = active.filter((c) => c.status === "warning").length;
  const failed = active.filter((c) => c.status === "fail").length;
  const score = (passed * 100 + warned * 60 + failed * 0) / active.length;
  return Math.round(Math.max(0, score));
}

function calcCommitQualityScore(commitCount: number, fileCount: number): number {
  // Reward: some commits, not zero test changes implied by commit count
  if (commitCount === 0) return 50;
  if (fileCount === 0) return 60;
  // Healthy ratio
  const ratio = commitCount / Math.max(fileCount, 1);
  if (ratio > 0.2 && ratio < 5) return 90;
  if (ratio >= 5) return 75; // too many commits per file
  return 70;
}

export function calculateSafetyScore(
  breakingChanges: BreakingChange[],
  testGaps: TestCoverageGap[],
  complianceChecks: ComplianceCheck[],
  commitCount: number,
  fileCount: number
): { score: number; dimensions: ScoreDimension[] } {
  const dimensions: ScoreDimension[] = [
    {
      name: "breakingChanges",
      label: "Breaking Changes",
      score: calcBreakingChangesScore(breakingChanges),
      weight: 0.35,
    },
    {
      name: "testCoverage",
      label: "Test Coverage",
      score: calcTestCoverageScore(testGaps),
      weight: 0.25,
    },
    {
      name: "compliance",
      label: "SOC2/ITIL Compliance",
      score: calcComplianceScore(complianceChecks),
      weight: 0.3,
    },
    {
      name: "commitQuality",
      label: "Commit Quality",
      score: calcCommitQualityScore(commitCount, fileCount),
      weight: 0.1,
    },
  ];

  const score = Math.round(
    dimensions.reduce((acc, d) => acc + d.score * d.weight, 0)
  );

  return { score, dimensions };
}

export function getRecommendation(
  score: number,
  breakingChanges: BreakingChange[]
): ReleaseReport["recommendation"] {
  const hasCritical = breakingChanges.some((c) => c.severity === "critical");
  if (score < 50 || hasCritical) return "UNSAFE";
  if (score < 72) return "CAUTION";
  return "SAFE";
}

export function generateSummary(
  score: number,
  recommendation: ReleaseReport["recommendation"],
  breakingChanges: BreakingChange[],
  testGaps: TestCoverageGap[],
  complianceChecks: ComplianceCheck[]
): string {
  const failedChecks = complianceChecks.filter((c) => c.status === "fail").length;
  const warnChecks = complianceChecks.filter((c) => c.status === "warning").length;
  const criticalChanges = breakingChanges.filter((c) => c.severity === "critical").length;

  if (recommendation === "UNSAFE") {
    return `Release is NOT SAFE to proceed. Score: ${score}/100. ${criticalChanges} critical breaking change(s) detected${failedChecks > 0 ? `, ${failedChecks} compliance failure(s)` : ""}. Immediate action required before deploying.`;
  }
  if (recommendation === "CAUTION") {
    return `Proceed with CAUTION. Score: ${score}/100. ${breakingChanges.length} breaking change(s), ${testGaps.length} test gap(s), and ${warnChecks} compliance warning(s) require review before release.`;
  }
  return `Release is SAFE to proceed. Score: ${score}/100. ${breakingChanges.length === 0 ? "No breaking changes detected." : `${breakingChanges.length} minor change(s) noted.`} Compliance checks ${failedChecks === 0 ? "passed" : `have ${failedChecks} issue(s)`}.`;
}
