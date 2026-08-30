import type { Phase, RunStatus } from './types.js';

export interface ColumnDefinition {
  key: Phase;
  title: string;
  description: string;
  /** Phases shown in this column, when it holds more than its own key. */
  accepts: Phase[];
}

/** Left-to-right order of the kanban board. `attention` is rendered as a separate lane. */
export const BOARD_COLUMNS: ColumnDefinition[] = [
  { key: 'backlog', title: 'Backlog', description: 'Open issues nobody has dispatched yet', accepts: ['backlog'] },
  { key: 'queued', title: 'Queued', description: 'Session created, waiting to start', accepts: ['queued'] },
  {
    key: 'investigating',
    title: 'Investigating',
    description: 'Devin is reading the code and planning',
    accepts: ['investigating'],
  },
  { key: 'implementing', title: 'Implementing', description: 'Devin is writing the fix', accepts: ['implementing'] },
  {
    key: 'validating',
    title: 'Validating',
    description: 'Tests, lint and typecheck are running',
    accepts: ['validating'],
  },
  {
    key: 'review',
    title: 'Awaiting your review',
    description: 'Pull request open — merge it to finish the issue',
    accepts: ['review'],
  },
  {
    key: 'merged',
    title: 'Merged',
    description: 'Pull request merged, or the issue was closed without one',
    accepts: ['merged', 'closed'],
  },
];

/** Phases a session moves through, used for the progress bar on a card. */
export const RUN_PHASE_ORDER: Phase[] = [
  'queued',
  'investigating',
  'implementing',
  'validating',
  'review',
  'merged',
];

export const PHASE_LABELS: Record<Phase, string> = {
  backlog: 'Backlog',
  queued: 'Queued',
  investigating: 'Investigating',
  implementing: 'Implementing',
  validating: 'Validating',
  review: 'Awaiting review',
  merged: 'Merged',
  closed: 'Closed',
  attention: 'Needs attention',
};

/**
 * Older rows (and the published playbook) use `done` for "Devin is finished". Only a merged pull
 * request earns `merged`, so a reported `done` means the work is waiting on the user.
 */
export function normalizePhase(value: string): Phase {
  if (value === 'done') return 'review';
  return isPhase(value) ? value : 'backlog';
}

export function isPhase(value: string): value is Phase {
  return Object.prototype.hasOwnProperty.call(PHASE_LABELS, value);
}

export function phaseRank(phase: Phase): number {
  const index = RUN_PHASE_ORDER.indexOf(phase);
  return index === -1 ? -1 : index;
}

/** Phases a session reports back through the callback endpoint. */
export const CALLBACK_PHASES: Phase[] = ['investigating', 'implementing', 'validating', 'review'];

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  pending: 'Queued',
  running: 'Running',
  blocked: 'Waiting on you',
  finished: 'Session complete',
  failed: 'Session failed',
  stopped: 'Session stopped',
};

/** Statuses where the session is over and the card cannot progress on its own. */
export const TERMINAL_RUN_STATUSES: RunStatus[] = ['finished', 'failed', 'stopped'];

export function isRunActive(status: RunStatus): boolean {
  return !TERMINAL_RUN_STATUSES.includes(status);
}

/** Devin is burning compute right now — the only state where stopping the session means anything. */
export function isRunWorking(status: RunStatus): boolean {
  return status === 'pending' || status === 'running';
}
