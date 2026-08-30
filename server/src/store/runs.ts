import { randomUUID } from 'node:crypto';
import type { Phase, RunDto, RunEventDto, RunStatus } from '../../../shared/types.js';
import { db, nowIso } from '../db/index.js';
import { toRunDto, toRunEventDto, type RunEventRow, type RunRow } from './rows.js';

export function createRun(issueNumber: number): RunDto {
  const id = randomUUID();
  const now = nowIso();
  db()
    .prepare(
      `INSERT INTO runs (id, issue_number, phase, status, created_at, updated_at)
       VALUES (?, ?, 'queued', 'pending', ?, ?)`,
    )
    .run(id, issueNumber, now, now);
  return getRun(id) as RunDto;
}

export function getRun(id: string): RunDto | null {
  const row = db().prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRow | undefined;
  return row ? toRunDto(row) : null;
}

export function getRunBySession(sessionId: string): RunDto | null {
  const row = db().prepare('SELECT * FROM runs WHERE session_id = ?').get(sessionId) as RunRow | undefined;
  return row ? toRunDto(row) : null;
}

/** Most recent run for an issue, which is what the board card renders. */
export function getLatestRunForIssue(issueNumber: number): RunDto | null {
  const row = db()
    .prepare('SELECT * FROM runs WHERE issue_number = ? ORDER BY created_at DESC LIMIT 1')
    .get(issueNumber) as RunRow | undefined;
  return row ? toRunDto(row) : null;
}

export function listRuns(): RunDto[] {
  const rows = db().prepare('SELECT * FROM runs ORDER BY created_at DESC').all() as RunRow[];
  return rows.map(toRunDto);
}

export function listActiveRuns(): RunDto[] {
  const rows = db()
    .prepare("SELECT * FROM runs WHERE status IN ('pending', 'running', 'blocked') ORDER BY created_at ASC")
    .all() as RunRow[];
  return rows.map(toRunDto);
}

/** Drops every run and event for an issue so the card falls back to the backlog. */
export function deleteRunsForIssue(issueNumber: number): number {
  const result = db().prepare('DELETE FROM runs WHERE issue_number = ?').run(issueNumber);
  return result.changes;
}

export interface RunUpdate {
  sessionId?: string | null;
  sessionUrl?: string | null;
  phase?: Phase;
  status?: RunStatus;
  statusDetail?: string | null;
  acus?: number;
  error?: string | null;
  messageCursor?: string | null;
  finishedAt?: string | null;
}

const COLUMN_BY_FIELD: Record<keyof RunUpdate, string> = {
  sessionId: 'session_id',
  sessionUrl: 'session_url',
  phase: 'phase',
  status: 'status',
  statusDetail: 'status_detail',
  acus: 'acus',
  error: 'error',
  messageCursor: 'message_cursor',
  finishedAt: 'finished_at',
};

/**
 * Writes only the fields that actually changed. Without this the session poller would touch
 * `updated_at` on every tick and the board could never show when a run last made progress.
 */
export function updateRun(id: string, update: RunUpdate): RunDto | null {
  const current = getRun(id);
  const entries = Object.entries(update).filter(
    ([field, value]) => value !== undefined && (!current || current[field as keyof RunDto] !== value),
  );
  if (entries.length > 0) {
    const assignments = entries.map(([field]) => `${COLUMN_BY_FIELD[field as keyof RunUpdate]} = ?`);
    const values = entries.map(([, value]) => value as string | number | null);
    db()
      .prepare(`UPDATE runs SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`)
      .run(...values, nowIso(), id);
  }
  return getRun(id);
}

export function getMessageCursor(runId: string): string | null {
  const row = db().prepare('SELECT message_cursor FROM runs WHERE id = ?').get(runId) as
    | { message_cursor: string | null }
    | undefined;
  return row?.message_cursor ?? null;
}

export interface RunEventInput {
  runId: string;
  kind: RunEventDto['kind'];
  message: string;
  source: RunEventDto['source'];
  phase?: Phase | null;
  externalId?: string | null;
}

/** Returns false when an event with the same externalId already exists. */
export function addRunEvent(event: RunEventInput): boolean {
  const result = db()
    .prepare(
      `INSERT OR IGNORE INTO run_events (run_id, kind, phase, message, source, external_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.runId,
      event.kind,
      event.phase ?? null,
      event.message,
      event.source,
      event.externalId ?? null,
      nowIso(),
    );
  return result.changes > 0;
}

export function listRunEvents(runId: string): RunEventDto[] {
  const rows = db()
    .prepare('SELECT * FROM run_events WHERE run_id = ? ORDER BY id ASC')
    .all(runId) as RunEventRow[];
  return rows.map(toRunEventDto);
}

export function listRecentEvents(limit = 50): RunEventDto[] {
  const rows = db()
    .prepare('SELECT * FROM run_events ORDER BY id DESC LIMIT ?')
    .all(limit) as RunEventRow[];
  return rows.map(toRunEventDto);
}
