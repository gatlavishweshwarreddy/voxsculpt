import type { RepoProvider, RepoInfo, CommitSummary, ChangedFile } from "@/types/analysis";

export function detectProvider(url: string): RepoProvider {
  if (url.includes("github.com")) return "github";
  if (url.includes("gitlab.com") || url.includes("gitlab.")) return "gitlab";
  return "unknown";
}

export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  // Handle formats:
  // https://github.com/owner/repo
  // https://github.com/owner/repo.git
  // git@github.com:owner/repo.git
  const httpsMatch = url.match(/(?:github|gitlab)\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/.*)?$/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  return null;
}

// ─── GitHub ──────────────────────────────────────────────────────────────────

const GH_BASE = "https://api.github.com";

function ghHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function fetchGitHubRepoInfo(
  owner: string,
  repo: string,
  token?: string
): Promise<RepoInfo> {
  const res = await fetch(`${GH_BASE}/repos/${owner}/${repo}`, {
    headers: ghHeaders(token),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub API error ${res.status}: ${err.message || res.statusText}`);
  }
  const data = await res.json();

  // Fetch latest commit
  const commitRes = await fetch(
    `${GH_BASE}/repos/${owner}/${repo}/commits/${data.default_branch}`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  const commitData = commitRes.ok ? await commitRes.json() : null;

  return {
    provider: "github",
    owner,
    repo,
    url: data.html_url,
    branch: data.default_branch,
    defaultBranch: data.default_branch,
    description: data.description,
    language: data.language,
    starCount: data.stargazers_count,
    lastCommitSha: commitData?.sha ?? "",
    lastCommitMessage: commitData?.commit?.message?.split("\n")[0] ?? "",
    lastCommitDate: commitData?.commit?.committer?.date ?? data.pushed_at,
  };
}

export async function fetchGitHubCommits(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
  perPage = 20
): Promise<CommitSummary[]> {
  const res = await fetch(
    `${GH_BASE}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${perPage}`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((c: Record<string, unknown>) => ({
    sha: (c.sha as string).substring(0, 7),
    message: ((c.commit as Record<string, unknown>).message as string).split("\n")[0],
    author:
      ((c.commit as Record<string, unknown>).author as Record<string, string>).name ??
      (c.author as Record<string, string> | null)?.login ??
      "unknown",
    date: ((c.commit as Record<string, unknown>).committer as Record<string, string>).date,
    url: c.html_url as string,
  }));
}

export async function fetchGitHubChangedFiles(
  owner: string,
  repo: string,
  base: string,
  head: string,
  token?: string
): Promise<ChangedFile[]> {
  const res = await fetch(
    `${GH_BASE}/repos/${owner}/${repo}/compare/${base}...${head}`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.files ?? []).map((f: Record<string, unknown>) => ({
    filename: f.filename as string,
    status: f.status as ChangedFile["status"],
    additions: f.additions as number,
    deletions: f.deletions as number,
    patch: f.patch as string | undefined,
  }));
}

export async function fetchGitHubFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  token?: string
): Promise<string | null> {
  const res = await fetch(
    `${GH_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  return null;
}

// ─── GitLab ───────────────────────────────────────────────────────────────────

const GL_BASE = "https://gitlab.com/api/v4";

function glHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["PRIVATE-TOKEN"] = token;
  return headers;
}

export async function fetchGitLabRepoInfo(
  owner: string,
  repo: string,
  token?: string
): Promise<RepoInfo> {
  const encodedId = encodeURIComponent(`${owner}/${repo}`);
  const res = await fetch(`${GL_BASE}/projects/${encodedId}`, {
    headers: glHeaders(token),
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitLab API error ${res.status}: ${(err as Record<string,string>).message || res.statusText}`);
  }
  const data = await res.json();

  // Fetch latest commit
  const commitRes = await fetch(
    `${GL_BASE}/projects/${encodedId}/repository/commits/${data.default_branch}`,
    { headers: glHeaders(token), next: { revalidate: 0 } }
  );
  const commitData = commitRes.ok ? await commitRes.json() : null;

  return {
    provider: "gitlab",
    owner,
    repo,
    url: data.web_url,
    branch: data.default_branch,
    defaultBranch: data.default_branch,
    description: data.description,
    language: null,
    starCount: data.star_count,
    lastCommitSha: commitData?.id?.substring(0, 7) ?? "",
    lastCommitMessage: commitData?.title ?? "",
    lastCommitDate: commitData?.committed_date ?? data.last_activity_at,
  };
}

export async function fetchGitLabCommits(
  owner: string,
  repo: string,
  branch: string,
  token?: string,
  perPage = 20
): Promise<CommitSummary[]> {
  const encodedId = encodeURIComponent(`${owner}/${repo}`);
  const res = await fetch(
    `${GL_BASE}/projects/${encodedId}/repository/commits?ref_name=${branch}&per_page=${perPage}`,
    { headers: glHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((c: Record<string, string>) => ({
    sha: c.id.substring(0, 7),
    message: c.title,
    author: c.author_name,
    date: c.committed_date,
    url: `https://gitlab.com/${owner}/${repo}/-/commit/${c.id}`,
  }));
}

export async function fetchGitLabChangedFiles(
  owner: string,
  repo: string,
  base: string,
  head: string,
  token?: string
): Promise<ChangedFile[]> {
  const encodedId = encodeURIComponent(`${owner}/${repo}`);
  const res = await fetch(
    `${GL_BASE}/projects/${encodedId}/repository/compare?from=${base}&to=${head}`,
    { headers: glHeaders(token), next: { revalidate: 0 } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.diffs ?? []).map((f: Record<string, unknown>) => ({
    filename: (f.new_path as string) || (f.old_path as string),
    status: f.deleted_file
      ? "removed"
      : f.new_file
      ? "added"
      : f.renamed_file
      ? "renamed"
      : "modified",
    additions: 0,
    deletions: 0,
    patch: f.diff as string | undefined,
  }));
}
