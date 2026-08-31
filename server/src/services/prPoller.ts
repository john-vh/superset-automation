import { config, githubConfigured } from '../config.js';
import { publishBoard, publishNotification } from '../events/bus.js';
import { addRunEvent } from '../store/runs.js';
import { listPullRequests } from '../store/pullRequests.js';
import { trackPullRequest } from './prTracking.js';

/**
 * Watches pull requests that are still open. The session poller stops once a run is terminal, but
 * the merge — the event that actually finishes an issue — usually happens long after that.
 */
export async function pollOpenPullRequests(): Promise<void> {
  if (!githubConfigured) return;

  const open = listPullRequests().filter((pr) => pr.state === 'open' && !pr.merged);
  if (open.length === 0) return;

  let changed = false;

  for (const pr of open) {
    try {
      const next = await trackPullRequest({ number: pr.number, issueNumber: pr.issueNumber, runId: pr.runId });
      if (next.merged === pr.merged && next.state === pr.state) continue;
      changed = true;

      const message = next.merged ? `PR #${pr.number} was merged` : `PR #${pr.number} was closed without merging`;
      if (pr.runId) addRunEvent({ runId: pr.runId, kind: 'system', source: 'github', message });

      publishNotification({
        level: next.merged ? 'success' : 'warning',
        title: next.merged
          ? `PR #${pr.number} merged${pr.issueNumber ? ` — #${pr.issueNumber} is done` : ''}`
          : `PR #${pr.number} was closed without merging`,
        body: next.title,
        issueNumber: pr.issueNumber,
      });
    } catch (error) {
      console.error('[pr-poller] failed:', error instanceof Error ? error.message : error);
    }
  }

  if (changed) publishBoard();
}

export function startPullRequestPoller(): NodeJS.Timeout | null {
  if (!githubConfigured) return null;
  return setInterval(() => {
    void pollOpenPullRequests();
  }, config.SESSION_POLL_INTERVAL_MS);
}
