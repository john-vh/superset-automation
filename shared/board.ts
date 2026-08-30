import type { Phase, RunStatus } from './types.js';

export interface ColumnDefinition {
  key: Phase;
  title: string;
  description: string;
}

/** Left-to-right order of the kanban board. `attention` is rendered as a separate lane. */
export const BOARD_COLUMNS: ColumnDefinition[] = [
  { key: 'backlog', title: 'Backlog', description: 'Open issues nobody has dispatched yet' },
  { key: 'queued', title: 'Queued', description: 'Session created, waiting to start' },
  { key: 'investigating', title: 'Investigating', description: 'Devin is reading the code and planning' },
  { key: 'implementing', title: 'Implementing', description: 'Devin is writing the fix' },
  { key: 'validating', title: 'Validating', description: 'Tests, lint and typecheck are running' },
  { key: 'review', title: 'Awaiting your review', description: 'Pull request open — merge it to finish the issue' },
  { key: 'done', title: 'Merged', description: 'Pull request merged, or the issue was closed' },
];

/** Phases a session moves through, used for the progress bar on a card. */
export const RUN_PHASE_ORDER: Phase[] = [
  'queued',
  'investigating',
  'implementing',
  'validating',
  'review',
  'done',
];

export const PHASE_LABELS: Record<Phase, string> = {
  backlog: 'Backlog',
  queued: 'Queued',
  investigating: 'Investigating',
  implementing: 'Implementing',
  validating: 'Validating',
  review: 'Awaiting review',
  done: 'Merged',
  attention: 'Needs attention',
};

export function phaseRank(phase: Phase): number {
  const index = RUN_PHASE_ORDER.indexOf(phase);
  return index === -1 ? -1 : index;
}

/** Phases a session reports back through the callback endpoint. */
export const CALLBACK_PHASES: Phase[] = ['investigating', 'implementing', 'validating', 'review', 'done'];

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  pending: 'Queued',
  running: 'Running',
  blocked: 'Waiting on you',
  finished: 'Session complete',
  failed: 'Session failed',
  stopped: 'Session ended',
};

/** Statuses where the session is over and the card cannot progress on its own. */
export const TERMINAL_RUN_STATUSES: RunStatus[] = ['finished', 'failed', 'stopped'];

export function isRunActive(status: RunStatus): boolean {
  return !TERMINAL_RUN_STATUSES.includes(status);
}
