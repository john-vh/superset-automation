import { config, githubRepo } from '../config.js';

export interface GithubIssue {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string } | string>;
  user: { login: string } | null;
  pull_request?: unknown;
}

export interface GithubPullRequest {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  head: { sha: string };
  body: string | null;
}

export interface GithubCheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: string | null;
  html_url: string | null;
}

export class GithubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GithubError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (config.GITHUB_TOKEN) headers.Authorization = `Bearer ${config.GITHUB_TOKEN}`;

  const response = await fetch(`${config.GITHUB_API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.text();
    throw new GithubError(`GitHub ${init.method ?? 'GET'} ${path} failed: ${response.status} ${detail}`, response.status);
  }
  return (await response.json()) as T;
}

/** Issues updated since the given ISO timestamp; pull requests are filtered out. */
export async function listIssuesSince(since?: string | null): Promise<GithubIssue[]> {
  const params = new URLSearchParams({ state: 'all', per_page: '100', sort: 'updated', direction: 'desc' });
  if (since) params.set('since', since);

  const issues = await request<GithubIssue[]>(
    `/repos/${githubRepo.owner}/${githubRepo.name}/issues?${params.toString()}`,
  );
  return issues.filter((issue) => !issue.pull_request);
}

export async function getPullRequest(number: number): Promise<GithubPullRequest> {
  return request<GithubPullRequest>(`/repos/${githubRepo.owner}/${githubRepo.name}/pulls/${number}`);
}

export async function listCheckRuns(ref: string): Promise<GithubCheckRun[]> {
  const data = await request<{ check_runs: GithubCheckRun[] }>(
    `/repos/${githubRepo.owner}/${githubRepo.name}/commits/${ref}/check-runs?per_page=100`,
  );
  return data.check_runs;
}

export function labelNames(labels: GithubIssue['labels']): string[] {
  return labels.map((label) => (typeof label === 'string' ? label : label.name));
}
