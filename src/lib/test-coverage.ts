import type { TestCoverageGap, ChangedFile } from "@/types/analysis";

// File patterns that should have test coverage
const TESTABLE_PATTERNS: Array<{ pattern: RegExp; area: string; suggestion: string }> = [
  {
    pattern: /src\/(api|routes|controllers?)\//i,
    area: "API Routes",
    suggestion: "Add integration tests covering success, error, and edge-case HTTP responses.",
  },
  {
    pattern: /src\/(services?|business|domain)\//i,
    area: "Business Logic",
    suggestion: "Add unit tests for all service methods, including error paths.",
  },
  {
    pattern: /src\/(utils?|helpers?|lib)\//i,
    area: "Utilities",
    suggestion: "Add unit tests for utility functions, especially edge cases and null inputs.",
  },
  {
    pattern: /src\/(hooks?)\//i,
    area: "React Hooks",
    suggestion: "Add React Testing Library hook tests using renderHook.",
  },
  {
    pattern: /src\/(components?)\//i,
    area: "UI Components",
    suggestion: "Add component rendering and interaction tests.",
  },
  {
    pattern: /src\/(store|redux|zustand|context)\//i,
    area: "State Management",
    suggestion: "Add state transition tests for all actions/reducers.",
  },
  {
    pattern: /migration|schema\.(sql|prisma)$/i,
    area: "Database Schema",
    suggestion: "Ensure migration has a rollback plan and add integration tests post-migration.",
  },
  {
    pattern: /middleware/i,
    area: "Middleware",
    suggestion: "Add tests for middleware chain including auth, logging, and error handling.",
  },
];

// Patterns that represent test files
const TEST_FILE_PATTERNS = [
  /\.test\.(ts|tsx|js|jsx)$/,
  /\.spec\.(ts|tsx|js|jsx)$/,
  /__tests__\//,
  /test\//,
];

function isTestFile(filename: string): boolean {
  return TEST_FILE_PATTERNS.some((p) => p.test(filename));
}

function getBaseFilename(filename: string): string {
  return filename
    .replace(/\.test\.(ts|tsx|js|jsx)$/, "")
    .replace(/\.spec\.(ts|tsx|js|jsx)$/, "")
    .replace(/__tests__\//, "")
    .replace(/\.(ts|tsx|js|jsx)$/, "");
}

export function analyzeTestCoverageGaps(files: ChangedFile[]): TestCoverageGap[] {
  const gaps: TestCoverageGap[] = [];
  const seen = new Set<string>();

  const sourceFiles = files.filter((f) => !isTestFile(f.filename) && f.status !== "removed");
  const testFiles = files.filter((f) => isTestFile(f.filename));

  // Check if changed source files have corresponding test changes
  const testedBases = new Set(testFiles.map((f) => getBaseFilename(f.filename)));
  const untestedSourceFiles: string[] = [];

  for (const sf of sourceFiles) {
    const base = getBaseFilename(sf.filename);
    const hasTest = Array.from(testedBases).some((t) => t.includes(base) || base.includes(t));
    if (!hasTest && (sf.filename.endsWith(".ts") || sf.filename.endsWith(".tsx") || sf.filename.endsWith(".js"))) {
      untestedSourceFiles.push(sf.filename);
    }
  }

  if (untestedSourceFiles.length > 0) {
    const key = "untested-source-files";
    if (!seen.has(key)) {
      seen.add(key);
      gaps.push({
        id: key,
        severity: untestedSourceFiles.length > 5 ? "high" : "medium",
        area: "Changed Source Files",
        description: `${untestedSourceFiles.length} source file(s) were modified without corresponding test file changes.`,
        files: untestedSourceFiles.slice(0, 8),
        suggestion:
          "Add or update tests for every changed source file, especially for new logic branches.",
      });
    }
  }

  // Check if critical areas lack tests
  for (const rule of TESTABLE_PATTERNS) {
    const matchingFiles = sourceFiles.filter((f) => rule.pattern.test(f.filename));
    if (matchingFiles.length === 0) continue;

    const hasMatchingTest = testFiles.some((tf) =>
      matchingFiles.some((sf) => {
        const sfBase = getBaseFilename(sf.filename).split("/").pop() ?? "";
        return tf.filename.includes(sfBase);
      })
    );

    if (!hasMatchingTest) {
      const key = `area-${rule.area}`;
      if (!seen.has(key)) {
        seen.add(key);
        gaps.push({
          id: key,
          severity: rule.area === "API Routes" || rule.area === "Business Logic" ? "high" : "medium",
          area: rule.area,
          description: `Changes detected in ${rule.area} but no corresponding tests were added or updated.`,
          files: matchingFiles.slice(0, 5).map((f) => f.filename),
          suggestion: rule.suggestion,
        });
      }
    }
  }

  // No tests at all
  if (testFiles.length === 0 && sourceFiles.length > 0) {
    gaps.push({
      id: "no-tests-in-changeset",
      severity: "critical",
      area: "Test Suite",
      description: "This changeset contains no test file additions or modifications whatsoever.",
      files: [],
      suggestion:
        "Add tests before releasing. Zero test coverage changes on a release is a critical quality risk.",
    });
  }

  return gaps.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity];
  });
}
