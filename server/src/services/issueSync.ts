import { config, githubConfigured, githubRepo } from '../config.js';
import { nowIso } from '../db/index.js';
import { publishBoard } from '../events/bus.js';
import { labelNames, type GithubIssue } from '../github/client.js';
import { listIssuesSince } from '../github/client.js';
import { upsertIssue } from '../store/issues.js';
import { setMeta, getMeta } from '../store/meta.js';
import { LAST_ISSUE_SYNC_KEY } from './board.js';

const LAST_SEEN_UPDATED_KEY = 'last_issue_updated_at';

export function storeIssue(issue: GithubIssue): void {
  upsertIssue({
    number: issue.number,
    repo: githubRepo.fullName,
    title: issue.title,
    body: issue.body ?? '',
    state: issue.state,
    labels: labelNames(issue.labels),
    author: issue.user?.login ?? '',
    url: issue.html_url,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
  });
}

export interface SyncResult {
  synced: number;
  skipped: boolean;
  error?: string;
}

/**
 * Reconciliation pass that backfills anything the webhook missed.
 * Uses `since` so repeat runs stay cheap against the GitHub rate limit.
 */
export async function syncIssues(options: { full?: boolean } = {}): Promise<SyncResult> {
  if (!githubConfigured) return { synced: 0, skipped: true, error: 'GITHUB_TOKEN is not configured' };

  const since = options.full ? null : getMeta(LAST_SEEN_UPDATED_KEY);
  const issues = await listIssuesSince(since);

  for (const issue of issues) storeIssue(issue);

  const newest = issues.map((issue) => issue.updated_at).sort().at(-1);
  if (newest) setMeta(LAST_SEEN_UPDATED_KEY, newest);
  setMeta(LAST_ISSUE_SYNC_KEY, nowIso());

  if (issues.length > 0) publishBoard();
  return { synced: issues.length, skipped: false };
}

export function startIssueSyncWorker(): NodeJS.Timeout | null {
  if (!githubConfigured) return null;

  const tick = () => {
    void syncIssues().catch((error: unknown) => {
      console.error('[issue-sync] failed:', error instanceof Error ? error.message : error);
    });
  };

  tick();
  return setInterval(tick, config.ISSUE_SYNC_INTERVAL_MS);
}
