/**
 * Contract shared by the Express server and the React client.
 * Runtime constants live in `shared/board.ts`.
 */

export type Phase =
  | 'backlog'
  | 'queued'
  | 'investigating'
  | 'implementing'
  | 'validating'
  | 'review'
  | 'done'
  | 'attention';

export type RunStatus = 'pending' | 'running' | 'blocked' | 'finished' | 'failed' | 'stopped';

export type CheckState = 'queued' | 'in_progress' | 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped';

export interface IssueDto {
  number: number;
  repo: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface RunEventDto {
  id: number;
  runId: string;
  kind: 'phase' | 'message' | 'system' | 'error';
  phase: Phase | null;
  message: string;
  source: 'devin' | 'app' | 'user' | 'github';
  createdAt: string;
}

export interface RunDto {
  id: string;
  issueNumber: number;
  sessionId: string | null;
  sessionUrl: string | null;
  phase: Phase;
  status: RunStatus;
  statusDetail: string | null;
  acus: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface CheckDto {
  id: string;
  prNumber: number;
  name: string;
  state: CheckState;
  url: string | null;
  updatedAt: string;
}

export interface PullRequestDto {
  number: number;
  repo: string;
  issueNumber: number | null;
  runId: string | null;
  title: string;
  url: string;
  state: 'open' | 'closed';
  merged: boolean;
  headSha: string | null;
  checks: CheckDto[];
  createdAt: string;
  updatedAt: string;
}

/** One kanban card: an issue plus whatever Devin has produced for it. */
export interface CardDto {
  issue: IssueDto;
  run: RunDto | null;
  pullRequest: PullRequestDto | null;
  phase: Phase;
  needsAttention: boolean;
}

export interface MetricsDto {
  issuesTotal: number;
  issuesOpen: number;
  runsActive: number;
  runsTotal: number;
  prsOpen: number;
  prsMerged: number;
  checksPassing: number;
  checksFailing: number;
  acusConsumed: number;
  /** `acusConsumed` priced at ACU_RATE_USD, or null when no rate is configured. */
  estimatedCostUsd: number | null;
  acuRateUsd: number | null;
  medianTimeToPrMs: number | null;
  successRate: number | null;
}

export interface NotificationDto {
  id: string;
  level: 'info' | 'success' | 'warning' | 'error';
  title: string;
  body: string;
  issueNumber: number | null;
  createdAt: string;
}

export interface BoardDto {
  repo: string;
  cards: CardDto[];
  metrics: MetricsDto;
  notifications: NotificationDto[];
  integrations: {
    devinConfigured: boolean;
    githubTokenConfigured: boolean;
    webhookConfigured: boolean;
    lastIssueSyncAt: string | null;
  };
}

export interface RunDetailDto {
  run: RunDto;
  issue: IssueDto;
  events: RunEventDto[];
  pullRequest: PullRequestDto | null;
}

export type StreamEvent =
  | { type: 'board'; board: BoardDto }
  | { type: 'notification'; notification: NotificationDto };
