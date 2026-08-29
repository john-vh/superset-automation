import type {
  BoardDto,
  CardDto,
  IssueDto,
  MetricsDto,
  Phase,
  PullRequestDto,
  RunDto,
} from '../../../shared/types.js';
import { config, devinConfigured, githubConfigured, githubRepo } from '../config.js';
import { listIssues } from '../store/issues.js';
import { getMeta } from '../store/meta.js';
import { listNotifications } from '../store/notifications.js';
import { getPullRequestForIssue, listPullRequests } from '../store/pullRequests.js';
import { getLatestRunForIssue, listRuns } from '../store/runs.js';

export const LAST_ISSUE_SYNC_KEY = 'last_issue_sync_at';

export function hasFailingCheck(pr: PullRequestDto | null): boolean {
  return Boolean(pr?.checks.some((check) => check.state === 'failure'));
}

export function resolvePhase(issue: IssueDto, run: RunDto | null, pr: PullRequestDto | null): Phase {
  if (pr?.merged) return 'done';
  if (!run) return issue.state === 'closed' ? 'done' : 'backlog';
  if (run.status === 'failed' || run.status === 'blocked') return 'attention';
  if (hasFailingCheck(pr)) return 'attention';
  if (pr && pr.state === 'open') return 'review';
  if (run.status === 'finished' && run.phase !== 'done') return pr ? 'review' : 'attention';
  return run.phase;
}

export function buildCards(): CardDto[] {
  return listIssues().map((issue) => {
    const run = getLatestRunForIssue(issue.number);
    const pullRequest = getPullRequestForIssue(issue.number);
    const phase = resolvePhase(issue, run, pullRequest);
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

  const completedRuns = runs.filter((run) => run.status === 'finished' || run.status === 'failed');
  const successfulRuns = completedRuns.filter((run) => run.status === 'finished');

  return {
    issuesTotal: cards.length,
    issuesOpen: cards.filter((card) => card.issue.state === 'open').length,
    runsActive: runs.filter((run) => run.status === 'pending' || run.status === 'running').length,
    runsTotal: runs.length,
    prsOpen: prs.filter((pr) => pr.state === 'open' && !pr.merged).length,
    prsMerged: prs.filter((pr) => pr.merged).length,
    checksPassing: checks.filter((check) => check.state === 'success').length,
    checksFailing: checks.filter((check) => check.state === 'failure').length,
    acusConsumed: Number(runs.reduce((total, run) => total + run.acus, 0).toFixed(2)),
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
