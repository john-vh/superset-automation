import type {
  BoardDto,
  CardDto,
  IssueDto,
  MetricsDto,
  Phase,
  PullRequestDto,
  RunDto,
} from '../../../shared/types.js';
import { TERMINAL_RUN_STATUSES } from '../../../shared/board.js';
import { config, devinConfigured, githubConfigured, githubRepo } from '../config.js';
import { listIssues } from '../store/issues.js';
import { getMeta, isIssueReset } from '../store/meta.js';
import { listNotifications } from '../store/notifications.js';
import { getPullRequestForIssue, listPullRequests } from '../store/pullRequests.js';
import { getLatestRunForIssue, listRuns } from '../store/runs.js';

export const LAST_ISSUE_SYNC_KEY = 'last_issue_sync_at';

export function hasFailingCheck(pr: PullRequestDto | null): boolean {
  return Boolean(pr?.checks.some((check) => check.state === 'failure'));
}

/**
 * `merged` means the pull request was actually merged — nothing else earns it. An open pull
 * request always resolves to `review` (the user owns the next action) no matter what the session
 * reported or whether the session has since ended.
 */
export function resolvePhase(issue: IssueDto, run: RunDto | null, pr: PullRequestDto | null): Phase {
  if (pr?.merged) return 'merged';
  if (hasFailingCheck(pr)) return 'attention';
  if (pr?.state === 'open') return 'review';
  if (!run) return issue.state === 'closed' ? 'closed' : 'backlog';
  if (run.status === 'failed' || run.status === 'blocked' || run.status === 'stopped') return 'attention';
  if (run.status === 'finished') return issue.state === 'closed' ? 'closed' : 'attention';
  // `review` and `merged` are claims about a pull request. Without one tracked, the session is
  // still Devin's to finish, so the card must not sit in a column that asks the user to act.
  if (run.phase === 'review' || run.phase === 'merged') return 'validating';
  return run.phase;
}

export function buildCards(): CardDto[] {
  return listIssues().map((issue) => {
    const run = getLatestRunForIssue(issue.number);
    const pullRequest = getPullRequestForIssue(issue.number);
    const cleared = !run && !pullRequest && isIssueReset(issue.number);
    const phase: Phase = cleared ? 'backlog' : resolvePhase(issue, run, pullRequest);
    return { issue, run, pullRequest, phase, needsAttention: phase === 'attention' };
  });
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function buildMetrics(cards: CardDto[]): MetricsDto {
  const runs = listRuns();
  const prs = listPullRequests();
  const checks = prs.flatMap((pr) => pr.checks);

  const timesToPr = cards
    .filter((card): card is CardDto & { run: RunDto; pullRequest: PullRequestDto } =>
      Boolean(card.run && card.pullRequest),
    )
    .map((card) => Date.parse(card.pullRequest.createdAt) - Date.parse(card.run.createdAt))
    .filter((delta) => Number.isFinite(delta) && delta >= 0);

  const completedRuns = runs.filter((run) => TERMINAL_RUN_STATUSES.includes(run.status));
  const successfulRuns = completedRuns.filter((run) => run.status === 'finished');
  const acusConsumed = Number(runs.reduce((total, run) => total + run.acus, 0).toFixed(2));
  const rate = config.ACU_RATE_USD;

  return {
    issuesTotal: cards.length,
    issuesOpen: cards.filter((card) => card.issue.state === 'open').length,
    runsActive: runs.filter((run) => run.status === 'pending' || run.status === 'running').length,
    runsTotal: runs.length,
    prsOpen: prs.filter((pr) => pr.state === 'open' && !pr.merged).length,
    prsMerged: prs.filter((pr) => pr.merged).length,
    checksPassing: checks.filter((check) => check.state === 'success').length,
    checksFailing: checks.filter((check) => check.state === 'failure').length,
    acusConsumed,
    estimatedCostUsd: rate ? Number((acusConsumed * rate).toFixed(2)) : null,
    acuRateUsd: rate ?? null,
    medianTimeToPrMs: median(timesToPr),
    successRate: completedRuns.length === 0 ? null : successfulRuns.length / completedRuns.length,
  };
}

export function buildBoard(): BoardDto {
  const cards = buildCards();
  return {
    repo: githubRepo.fullName,
    cards,
    metrics: buildMetrics(cards),
    notifications: listNotifications(),
    integrations: {
      devinConfigured,
      githubTokenConfigured: githubConfigured,
      webhookConfigured: Boolean(config.GITHUB_WEBHOOK_SECRET),
      lastIssueSyncAt: getMeta(LAST_ISSUE_SYNC_KEY),
    },
  };
}
