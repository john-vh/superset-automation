import type { CheckState } from '../../../shared/types.js';
import type { GithubCheckRun } from '../github/client.js';

const CONCLUSION_STATES: Record<string, CheckState> = {
  success: 'success',
  failure: 'failure',
  timed_out: 'failure',
  action_required: 'failure',
  startup_failure: 'failure',
  cancelled: 'cancelled',
  skipped: 'skipped',
  neutral: 'neutral',
  stale: 'neutral',
};

export function mapCheckState(run: Pick<GithubCheckRun, 'status' | 'conclusion'>): CheckState {
  if (run.status === 'queued') return 'queued';
  if (run.status === 'in_progress') return 'in_progress';
  return CONCLUSION_STATES[run.conclusion ?? ''] ?? 'neutral';
}

/** Pulls the issue number out of a PR body/title using GitHub's closing keywords. */
export function linkedIssueNumber(text: string): number | null {
  const match = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/i.exec(text);
  if (match?.[1]) return Number(match[1]);

  const bare = /(?:^|\s)#(\d+)\b/.exec(text);
  return bare?.[1] ? Number(bare[1]) : null;
}
