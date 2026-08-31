import { normalizePhase } from '../../../shared/board.js';
import type {
  CheckDto,
  CheckState,
  IssueDto,
  NotificationDto,
  PullRequestDto,
  RunDto,
  RunEventDto,
  RunStatus,
} from '../../../shared/types.js';

export interface IssueRow {
  number: number;
  repo: string;
  title: string;
  body: string;
  state: string;
  labels: string;
  author: string;
  url: string;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

export interface RunRow {
  id: string;
  issue_number: number;
  session_id: string | null;
  session_url: string | null;
  phase: string;
  status: string;
  status_detail: string | null;
  acus: number;
  error: string | null;
  message_cursor: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export interface RunEventRow {
  id: number;
  run_id: string;
  kind: string;
  phase: string | null;
  message: string;
  source: string;
  external_id: string | null;
  created_at: string;
}

export interface PullRequestRow {
  number: number;
  repo: string;
  issue_number: number | null;
  run_id: string | null;
  title: string;
  url: string;
  state: string;
  merged: number;
  head_sha: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckRow {
  id: string;
  pr_number: number;
  name: string;
  state: string;
  url: string | null;
  updated_at: string;
}

export interface NotificationRow {
  id: string;
  level: string;
  title: string;
  body: string;
  issue_number: number | null;
  created_at: string;
}

function parseLabels(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function toIssueDto(row: IssueRow): IssueDto {
  return {
    number: row.number,
    repo: row.repo,
    title: row.title,
    body: row.body,
    state: row.state === 'closed' ? 'closed' : 'open',
    labels: parseLabels(row.labels),
    author: row.author,
    url: row.url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRunDto(row: RunRow): RunDto {
  return {
    id: row.id,
    issueNumber: row.issue_number,
    sessionId: row.session_id,
    sessionUrl: row.session_url,
    phase: normalizePhase(row.phase),
    status: row.status as RunStatus,
    statusDetail: row.status_detail,
    acus: row.acus,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

export function toRunEventDto(row: RunEventRow): RunEventDto {
  return {
    id: row.id,
    runId: row.run_id,
    kind: row.kind as RunEventDto['kind'],
    phase: row.phase === null ? null : normalizePhase(row.phase),
    message: row.message,
    source: row.source as RunEventDto['source'],
    createdAt: row.created_at,
  };
}

export function toCheckDto(row: CheckRow): CheckDto {
  return {
    id: row.id,
    prNumber: row.pr_number,
    name: row.name,
    state: row.state as CheckState,
    url: row.url,
    updatedAt: row.updated_at,
  };
}

export function toPullRequestDto(row: PullRequestRow, checks: CheckDto[]): PullRequestDto {
  return {
    number: row.number,
    repo: row.repo,
    issueNumber: row.issue_number,
    runId: row.run_id,
    title: row.title,
    url: row.url,
    state: row.state === 'closed' ? 'closed' : 'open',
    merged: row.merged === 1,
    headSha: row.head_sha,
    checks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    level: row.level as NotificationDto['level'],
    title: row.title,
    body: row.body,
    issueNumber: row.issue_number,
    createdAt: row.created_at,
  };
}
