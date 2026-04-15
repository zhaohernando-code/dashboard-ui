import { DEFAULT_API_BASE, GITHUB_STATUS_ISSUE_TITLE } from "./dashboardConstants";

export function summarizeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function createApiRequest(sessionToken: string) {
  return async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${DEFAULT_API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(init?.headers || {}),
      },
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || `Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  };
}

export async function githubApiRequest<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || `GitHub API failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function createGithubRequest(githubToken: string, unauthenticatedMessage: string) {
  return async function githubRequest<T>(path: string, init?: RequestInit): Promise<T> {
    if (!githubToken) {
      throw new Error(unauthenticatedMessage);
    }
    return githubApiRequest<T>(path, init, githubToken);
  };
}

export async function loadGithubStatusSnapshot<T>(input: {
  githubTaskRepo: string;
  githubToken: string;
  parsePayload: (body: string) => T | null;
}) {
  const { githubTaskRepo, githubToken, parsePayload } = input;
  const [owner, repo] = githubTaskRepo.split("/");
  const issues = await githubApiRequest<Array<{
    number: number;
    title: string;
    body: string;
    state: string;
    updated_at: string;
    pull_request?: unknown;
  }>>(`/repos/${owner}/${repo}/issues?state=open&per_page=30&sort=updated&direction=desc`, undefined, githubToken || undefined);
  const issue = issues.find(
    (item) => !item.pull_request && (item.title?.trim() === GITHUB_STATUS_ISSUE_TITLE || /<!--\s*codex-status-snapshot\s*[\s\S]*?-->/i.test(item.body || "")),
  );
  if (!issue) {
    return null;
  }
  return parsePayload(issue.body || "");
}

export function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
