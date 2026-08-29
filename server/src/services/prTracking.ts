import type { PullRequestDto } from '../../../shared/types.js';
import { githubConfigured, githubRepo } from '../config.js';
import { getPullRequest as fetchPullRequest, listCheckRuns } from '../github/client.js';
import { getPullRequest, upsertCheck, upsertPullRequest } from '../store/pullRequests.js';
import { linkedIssueNumber, mapCheckState } from './checks.js';

export interface TrackPullRequestInput {
  number: number;
  issueNumber?: number | null;
  runId?: string | null;
  title?: string;
  url?: string;
  state?: 'open' | 'closed';
  merged?: boolean;
  headSha?: string | null;
  body?: string;
}

/**
 * Records a PR on the board and, when a GitHub token is available, enriches it with the
 * live PR state and its GitHub Actions check runs.
 */
export async function trackPullRequest(input: TrackPullRequestInput): Promise<PullRequestDto> {
  let issueNumber = input.issueNumber ?? null;
  let title = input.title ?? `PR #${input.number}`;
  let url = input.url ?? `https://github.com/${githubRepo.fullName}/pull/${input.number}`;
  let state: 'open' | 'closed' = input.state ?? 'open';
  let merged = input.merged ?? false;
  let headSha = input.headSha ?? null;

  if (githubConfigured) {
    try {
      const pr = await fetchPullRequest(input.number);
      title = pr.title;
      url = pr.html_url;
      state = pr.state;
      merged = Boolean(pr.merged_at);
      headSha = pr.head.sha;
      issueNumber ??= linkedIssueNumber(`${pr.body ?? ''}\n${pr.title}`);
    } catch (error) {
      console.error('[pr-tracking] could not fetch PR:', error instanceof Error ? error.message : error);
    }
  }

  issueNumber ??= linkedIssueNumber(`${input.body ?? ''}\n${title}`);

  const stored = upsertPullRequest({
    number: input.number,
    repo: githubRepo.fullName,
    issueNumber,
    runId: input.runId ?? null,
    title,
    url,
    state,
    merged,
    headSha,
  });

  if (githubConfigured && headSha) await refreshChecks(input.number, headSha);
  return getPullRequest(input.number) ?? stored;
}

export async function refreshChecks(prNumber: number, headSha: string): Promise<void> {
  try {
    const runs = await listCheckRuns(headSha);
    for (const run of runs) {
      upsertCheck({
        id: String(run.id),
        prNumber,
        name: run.name,
        state: mapCheckState(run),
        url: run.html_url,
      });
    }
  } catch (error) {
    console.error('[pr-tracking] could not fetch checks:', error instanceof Error ? error.message : error);
  }
}

export function pullRequestNumberFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  const match = /\/pull\/(\d+)/.exec(url);
  return match?.[1] ? Number(match[1]) : null;
}
