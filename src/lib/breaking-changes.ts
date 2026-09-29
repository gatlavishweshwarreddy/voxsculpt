import type { BreakingChange, ChangedFile, CommitSummary, Severity } from "@/types/analysis";

// Patterns that strongly suggest breaking changes
const BREAKING_PATTERNS = [
  {
    pattern: /BREAKING[- ]CHANGE/i,
    type: "api_signature" as const,
    severity: "critical" as Severity,
    title: "Explicit BREAKING CHANGE in commit message",
  },
  {
    pattern: /!feat|!fix|!refactor/i,
    type: "api_signature" as const,
    severity: "high" as Severity,
    title: "Conventional Commits breaking change marker (!)",
  },
  {
    pattern: /drop(?:ped)?\s+support/i,
    type: "removed_export" as const,
    severity: "high" as Severity,
    title: "Dropped support detected in commit message",
  },
  {
    pattern: /deprecat(?:e|ed|ing)/i,
    type: "removed_export" as const,
    severity: "medium" as Severity,
    title: "Deprecation detected",
  },
  {
    pattern: /remov(?:e|ed|ing)\s+(?:api|endpoint|method|function|class|interface)/i,
    type: "removed_export" as const,
    severity: "critical" as Severity,
    title: "API/method removal detected",
  },
  {
    pattern: /migrat(?:e|ion)/i,
    type: "schema_change" as const,
    severity: "high" as Severity,
    title: "Migration detected",
  },
];

const BREAKING_FILE_PATTERNS: Array<{
  pattern: RegExp;
  type: BreakingChange["type"];
  severity: Severity;
  title: string;
}> = [
  {
    pattern: /package\.json$/,
    type: "dependency_major",
    severity: "medium",
    title: "package.json changed — check for major version bumps",
  },
  {
    pattern: /\.env\.example$|\.env\.template$/,
    type: "env_var",
    severity: "high",
    title: "Environment variable template changed",
  },
  {
    pattern: /migration|schema\.(sql|prisma|graphql)$/i,
    type: "schema_change",
    severity: "critical",
    title: "Database schema or migration file changed",
  },
  {
    pattern: /openapi|swagger\.(json|ya?ml)$/i,
    type: "api_signature",
    severity: "critical",
    title: "OpenAPI/Swagger spec changed",
  },
  {
    pattern: /\bapi\/.*\.(ts|js|py|go|rb|java)$/,
    type: "api_signature",
    severity: "medium",
    title: "API route file modified",
  },
];

// Detect major version bumps in package.json patch
function detectMajorVersionBumps(patch: string, file: string): BreakingChange[] {
  const results: BreakingChange[] = [];
  const addedLines = patch.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));

  for (const line of addedLines) {
    // Match "^X.y.z" or "X.y.z" where X > 0 could be a major bump
    const majorMatch = line.match(/"([^"]+)":\s*"\^?(\d+)\.\d+\.\d+"/);
    if (majorMatch && parseInt(majorMatch[2]) >= 1) {
      results.push({
        id: `dep-${majorMatch[1]}-${Date.now()}`,
        type: "dependency_major",
        severity: parseInt(majorMatch[2]) >= 2 ? "high" : "medium",
        title: `Dependency update: ${majorMatch[1]}@${majorMatch[2]}.x`,
        description: `Package ${majorMatch[1]} was updated to major version ${majorMatch[2]}. This may introduce breaking changes.`,
        file,
        evidence: line.trim(),
        affectedConsumers: [],
      });
    }
  }
  return results;
}

// Scan patch diff for removed exports
function detectRemovedExports(patch: string, file: string): BreakingChange[] {
  const results: BreakingChange[] = [];
  const removedLines = patch.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));

  for (const line of removedLines) {
    if (/export\s+(default\s+)?(function|class|const|interface|type|enum)\s+(\w+)/.test(line)) {
      const match = line.match(
        /export\s+(?:default\s+)?(?:function|class|const|interface|type|enum)\s+(\w+)/
      );
      if (match) {
        results.push({
          id: `export-${match[1]}-${Date.now()}`,
          type: "removed_export",
          severity: "high",
          title: `Removed export: ${match[1]}`,
          description: `Public export "${match[1]}" was removed from ${file}. Any code importing this will break.`,
          file,
          evidence: line.trim(),
          affectedConsumers: [],
        });
      }
    }
  }
  return results;
}

export function analyzeBreakingChanges(
  commits: CommitSummary[],
  files: ChangedFile[]
): BreakingChange[] {
  const changes: BreakingChange[] = [];
  const seen = new Set<string>();

  const addUnique = (change: BreakingChange) => {
    const key = `${change.type}-${change.title}-${change.file}`;
    if (!seen.has(key)) {
      seen.add(key);
      changes.push(change);
    }
  };

  // Scan commit messages
  for (const commit of commits) {
    for (const bp of BREAKING_PATTERNS) {
      if (bp.pattern.test(commit.message)) {
        addUnique({
          id: `commit-${commit.sha}`,
          type: bp.type,
          severity: bp.severity,
          title: bp.title,
          description: `Detected in commit ${commit.sha}: "${commit.message}"`,
          file: "commit message",
          evidence: commit.message,
          affectedConsumers: [],
        });
      }
    }
  }

  // Scan changed files
  for (const file of files) {
    for (const fp of BREAKING_FILE_PATTERNS) {
      if (fp.pattern.test(file.filename)) {
        // Extra analysis for package.json
        if (file.filename === "package.json" && file.patch) {
          const majorBumps = detectMajorVersionBumps(file.patch, file.filename);
          majorBumps.forEach(addUnique);
        } else {
          addUnique({
            id: `file-${file.filename}-${fp.type}`,
            type: fp.type,
            severity:
              file.status === "removed" && fp.severity !== "critical" ? "high" : fp.severity,
            title: fp.title,
            description: `File "${file.filename}" was ${file.status}. ${fp.title}`,
            file: file.filename,
            evidence: `Status: ${file.status}, +${file.additions}/-${file.deletions} lines`,
            affectedConsumers: [],
          });
        }
      }
    }

    // Removed files — always breaking
    if (file.status === "removed") {
      addUnique({
        id: `removed-${file.filename}`,
        type: "removed_export",
        severity: "critical",
        title: `File removed: ${file.filename}`,
        description: `The file "${file.filename}" was deleted. All imports from this file will break.`,
        file: file.filename,
        evidence: `Deleted file with ${file.deletions} removed lines`,
        affectedConsumers: [],
      });
    }

    // Scan patches for removed exports
    if (file.patch && (file.filename.endsWith(".ts") || file.filename.endsWith(".js"))) {
      detectRemovedExports(file.patch, file.filename).forEach(addUnique);
    }
  }

  return changes.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return order[a.severity] - order[b.severity];
  });
}
