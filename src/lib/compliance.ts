import type { ComplianceCheck, ChangedFile, CommitSummary, RepoInfo } from "@/types/analysis";

interface CheckRule {
  id: string;
  framework: ComplianceCheck["framework"];
  category: string;
  title: string;
  evaluate: (context: ComplianceContext) => {
    status: ComplianceCheck["status"];
    description: string;
    evidence: string | null;
    remediation: string | null;
  };
}

interface ComplianceContext {
  files: ChangedFile[];
  commits: CommitSummary[];
  repo: RepoInfo;
  fileNames: string[];
  commitMessages: string[];
}

const COMPLIANCE_RULES: CheckRule[] = [
  // ─── SOC2 ─────────────────────────────────────────────────────────────────
  {
    id: "soc2-change-management",
    framework: "SOC2",
    category: "Change Management",
    title: "Change documented with descriptive commit messages",
    evaluate: ({ commits }) => {
      const vague = commits.filter((c) =>
        /^(fix|update|change|misc|wip|temp|test|stuff|tweaks?)\.?$/i.test(c.message.trim())
      );
      const ratio = vague.length / Math.max(commits.length, 1);
      if (ratio > 0.4) {
        return {
          status: "fail",
          description: `${vague.length} of ${commits.length} commit messages are too vague to document change intent.`,
          evidence: vague
            .slice(0, 3)
            .map((c) => `"${c.message}"`)
            .join(", "),
          remediation: "Use descriptive commit messages following Conventional Commits or a similar standard.",
        };
      }
      if (ratio > 0.2) {
        return {
          status: "warning",
          description: `Some commit messages lack descriptive change documentation.`,
          evidence: null,
          remediation: "Improve commit message quality for audit trail compliance.",
        };
      }
      return {
        status: "pass",
        description: "Commit messages provide adequate change documentation.",
        evidence: null,
        remediation: null,
      };
    },
  },
  {
    id: "soc2-secrets-exposure",
    framework: "SOC2",
    category: "Security",
    title: "No secrets or credentials committed",
    evaluate: ({ files }) => {
      const secretPatterns = [
        /api[_-]?key\s*=\s*['"]\w{16,}/i,
        /secret[_-]?key\s*=\s*['"]\w{16,}/i,
        /password\s*=\s*['"][^'"]{6,}/i,
        /token\s*=\s*['"][a-zA-Z0-9_\-]{20,}/i,
        /private[_-]?key/i,
        /-----BEGIN\s+(RSA|EC|PRIVATE)/,
        /ghp_[a-zA-Z0-9]{36}/,
        /glpat-[a-zA-Z0-9_-]{20}/,
      ];
      const violations: string[] = [];
      for (const file of files) {
        if (!file.patch) continue;
        const addedLines = file.patch
          .split("\n")
          .filter((l) => l.startsWith("+") && !l.startsWith("+++"));
        for (const line of addedLines) {
          if (secretPatterns.some((p) => p.test(line))) {
            violations.push(file.filename);
            break;
          }
        }
      }
      if (violations.length > 0) {
        return {
          status: "fail",
          description: `Potential secrets detected in ${violations.length} file(s).`,
          evidence: violations.join(", "),
          remediation: "Remove secrets immediately, rotate credentials, use environment variables or secret managers.",
        };
      }
      return {
        status: "pass",
        description: "No obvious secrets or credentials detected in diffs.",
        evidence: null,
        remediation: null,
      };
    },
  },
  {
    id: "soc2-env-documentation",
    framework: "SOC2",
    category: "Configuration Management",
    title: "Environment variables documented",
    evaluate: ({ fileNames }) => {
      const hasEnvExample = fileNames.some((f) => /\.env\.(example|template|sample)$/i.test(f));
      const hasEnvChange = fileNames.some((f) => /^\.env$/i.test(f));
      if (hasEnvChange && !hasEnvExample) {
        return {
          status: "warning",
          description: ".env file was changed but no .env.example or template file was updated.",
          evidence: ".env changed without documentation",
          remediation: "Update .env.example to document all required environment variables.",
        };
      }
      if (hasEnvExample) {
        return {
          status: "pass",
          description: "Environment variables are documented via template file.",
          evidence: null,
          remediation: null,
        };
      }
      return {
        status: "na",
        description: "No environment variable files detected in changeset.",
        evidence: null,
        remediation: null,
      };
    },
  },
  {
    id: "soc2-dependency-audit",
    framework: "SOC2",
    category: "Vendor Management",
    title: "Dependency changes reviewed",
    evaluate: ({ fileNames, files }) => {
      const lockChanged = fileNames.some((f) =>
        /package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Pipfile\.lock|go\.sum|Cargo\.lock/.test(f)
      );
      const manifestChanged = fileNames.some((f) => /package\.json|requirements\.txt|Pipfile|go\.mod|Cargo\.toml/.test(f));
      if (manifestChanged && !lockChanged) {
        return {
          status: "warning",
          description: "Dependency manifest changed but lock file was not updated.",
          evidence: null,
          remediation: "Run package manager install to update lock file and commit it.",
        };
      }
      if (lockChanged) {
        const lockFile = files.find((f) =>
          /package-lock\.json|yarn\.lock|pnpm-lock\.yaml/.test(f.filename)
        );
        return {
          status: "pass",
          description: `Lock file updated (${lockFile?.additions ?? 0} additions, ${lockFile?.deletions ?? 0} deletions).`,
          evidence: null,
          remediation: null,
        };
      }
      return {
        status: "na",
        description: "No dependency changes detected.",
        evidence: null,
        remediation: null,
      };
    },
  },
  // ─── ITIL ─────────────────────────────────────────────────────────────────
  {
    id: "itil-release-notes",
    framework: "ITIL",
    category: "Release Management",
    title: "Release notes or changelog updated",
    evaluate: ({ fileNames }) => {
      const hasChangelog = fileNames.some((f) =>
        /CHANGELOG|RELEASE[_-]?NOTES|HISTORY/i.test(f)
      );
      if (hasChangelog) {
        return {
          status: "pass",
          description: "Changelog or release notes file was updated in this changeset.",
          evidence: null,
          remediation: null,
        };
      }
      return {
        status: "warning",
        description: "No CHANGELOG or release notes file was updated.",
        evidence: null,
        remediation: "Update CHANGELOG.md with a summary of changes for this release.",
      };
    },
  },
  {
    id: "itil-rollback-plan",
    framework: "ITIL",
    category: "Change Management",
    title: "Database migrations are reversible",
    evaluate: ({ fileNames, files }) => {
      const hasMigration = fileNames.some((f) => /migration/i.test(f));
      if (!hasMigration) {
        return {
          status: "na",
          description: "No migration files detected.",
          evidence: null,
          remediation: null,
        };
      }
      const migrationFiles = files.filter((f) => /migration/i.test(f.filename));
      const hasDown = migrationFiles.some(
        (f) => f.patch && /down|rollback|revert/i.test(f.patch)
      );
      if (hasDown) {
        return {
          status: "pass",
          description: "Migration files contain rollback/down methods.",
          evidence: null,
          remediation: null,
        };
      }
      return {
        status: "warning",
        description: "Migration files detected but no rollback (down) method found.",
        evidence: migrationFiles.map((f) => f.filename).join(", "),
        remediation: "Add a down() or rollback() migration method for each schema change.",
      };
    },
  },
  {
    id: "itil-config-management",
    framework: "ITIL",
    category: "Configuration Management",
    title: "Infrastructure/config changes tracked",
    evaluate: ({ fileNames }) => {
      const infraFiles = fileNames.filter((f) =>
        /\.(ya?ml|json|toml|ini|conf|config|tf|tfvars|hcl|dockerfile|docker-compose)/i.test(f) &&
        !/node_modules/.test(f)
      );
      if (infraFiles.length > 0) {
        return {
          status: "warning",
          description: `${infraFiles.length} configuration/infrastructure file(s) changed — ensure these are reviewed.`,
          evidence: infraFiles.slice(0, 4).join(", "),
          remediation: "Infrastructure and config changes should go through a formal change approval process.",
        };
      }
      return {
        status: "pass",
        description: "No infrastructure or configuration files changed.",
        evidence: null,
        remediation: null,
      };
    },
  },
  {
    id: "itil-availability",
    framework: "ITIL",
    category: "Availability Management",
    title: "Health check and monitoring endpoints maintained",
    evaluate: ({ fileNames }) => {
      const hasHealthRoute = fileNames.some((f) =>
        /health|ping|status|ready|alive/i.test(f)
      );
      const modifiedHealthRoute = fileNames.some(
        (f) => /health|ping|status/i.test(f)
      );
      if (modifiedHealthRoute) {
        return {
          status: "warning",
          description: "Health/status endpoint files were modified — verify monitoring still works.",
          evidence: null,
          remediation: "Test monitoring and alerting after deployment.",
        };
      }
      if (hasHealthRoute) {
        return {
          status: "pass",
          description: "Health check endpoints are present in the codebase.",
          evidence: null,
          remediation: null,
        };
      }
      return {
        status: "na",
        description: "No health check endpoints detected in changeset.",
        evidence: null,
        remediation: null,
      };
    },
  },
  // ─── General ──────────────────────────────────────────────────────────────
  {
    id: "general-console-logs",
    framework: "general",
    category: "Code Quality",
    title: "No debug console.log statements added",
    evaluate: ({ files }) => {
      const violations: string[] = [];
      for (const file of files) {
        if (!file.patch) continue;
        const addedLogs = file.patch
          .split("\n")
          .filter(
            (l) =>
              l.startsWith("+") &&
              !l.startsWith("+++") &&
              /console\.(log|debug|warn|error)\s*\(/.test(l) &&
              !/\/\/.*console/.test(l)
          );
        if (addedLogs.length > 0) violations.push(`${file.filename} (${addedLogs.length})`);
      }
      if (violations.length > 0) {
        return {
          status: "warning",
          description: `console.log/debug statements added in ${violations.length} file(s).`,
          evidence: violations.slice(0, 3).join(", "),
          remediation: "Remove debug logging before release or replace with structured logger.",
        };
      }
      return {
        status: "pass",
        description: "No debug console statements detected in added lines.",
        evidence: null,
        remediation: null,
      };
    },
  },
  {
    id: "general-todo-fixme",
    framework: "general",
    category: "Code Quality",
    title: "No unresolved TODO/FIXME/HACK markers added",
    evaluate: ({ files }) => {
      const markers: string[] = [];
      for (const file of files) {
        if (!file.patch) continue;
        const addedMarkers = file.patch
          .split("\n")
          .filter(
            (l) =>
              l.startsWith("+") &&
              !l.startsWith("+++") &&
              /\b(TODO|FIXME|HACK|XXX)\b/.test(l)
          );
        if (addedMarkers.length > 0)
          markers.push(`${file.filename} (${addedMarkers.length})`);
      }
      if (markers.length > 0) {
        return {
          status: "warning",
          description: `New TODO/FIXME/HACK markers added in ${markers.length} file(s).`,
          evidence: markers.slice(0, 3).join(", "),
          remediation: "Resolve or track technical debt items before release.",
        };
      }
      return {
        status: "pass",
        description: "No new TODO/FIXME/HACK markers added.",
        evidence: null,
        remediation: null,
      };
    },
  },
];

export function runComplianceChecks(
  files: ChangedFile[],
  commits: CommitSummary[],
  repo: RepoInfo
): ComplianceCheck[] {
  const fileNames = files.map((f) => f.filename);
  const commitMessages = commits.map((c) => c.message);
  const context: ComplianceContext = { files, commits, repo, fileNames, commitMessages };

  return COMPLIANCE_RULES.map((rule) => {
    const result = rule.evaluate(context);
    return {
      id: rule.id,
      framework: rule.framework,
      category: rule.category,
      title: rule.title,
      ...result,
    };
  });
}
