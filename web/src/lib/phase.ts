import { isRunWorking } from '@shared/board';
import type { CardDto, CheckState, Phase, RunStatus } from '@shared/types';

/**
 * Tones map to ownership and health, never to a specific phase:
 * `active` = Devin is working, `attention` = you are, `success`/`danger` = it ended well or badly.
 */
export type Tone = 'neutral' | 'active' | 'attention' | 'success' | 'danger';

export const RUN_STATUS_TONES: Record<RunStatus, Tone> = {
  pending: 'neutral',
  running: 'active',
  blocked: 'attention',
  finished: 'neutral',
  failed: 'danger',
  stopped: 'danger',
};

export const PHASE_TONES: Record<Phase, Tone> = {
  backlog: 'neutral',
  queued: 'neutral',
  investigating: 'active',
  implementing: 'active',
  validating: 'active',
  review: 'attention',
  merged: 'success',
  closed: 'neutral',
  attention: 'attention',
};

export const CHECK_TONES: Record<CheckState, Tone> = {
  queued: 'neutral',
  in_progress: 'active',
  success: 'success',
  failure: 'danger',
  neutral: 'neutral',
  cancelled: 'neutral',
  skipped: 'neutral',
};

export const CHECK_LABELS: Record<CheckState, string> = {
  queued: 'queued',
  in_progress: 'running',
  success: 'passed',
  failure: 'failed',
  neutral: 'neutral',
  cancelled: 'cancelled',
  skipped: 'skipped',
};

const LIVE_PHASE_LABELS: Partial<Record<Phase, string>> = {
  queued: 'Starting',
  investigating: 'Investigating',
  implementing: 'Implementing',
  validating: 'Validating',
};

export interface StatusPill {
  label: string;
  tone: Tone;
  /** True when the pill only restates the column it sits in, so a card in that column omits it. */
  restatesColumn: boolean;
}

export function failingChecks(card: CardDto): number {
  return card.pullRequest?.checks.filter((check) => check.state === 'failure').length ?? 0;
}

/**
 * At most one pill per card, and only for the most urgent thing that is true. The column already
 * says which phase a card is in, so a pill has to earn its place by adding something the column
 * does not: a failure, a hand-off to the user, or a completed merge.
 */
export function statusPill(card: CardDto): StatusPill | null {
  const { run, phase } = card;
  const failing = failingChecks(card);

  if (failing > 0) {
    return { label: `${failing} check${failing === 1 ? '' : 's'} failing`, tone: 'danger', restatesColumn: false };
  }
  // An open pull request is a hand-off, so it outranks however the session happened to end.
  if (phase === 'review') return { label: 'Review & merge', tone: 'attention', restatesColumn: true };

  if (run?.status === 'failed') return { label: 'Session failed', tone: 'danger', restatesColumn: false };
  if (run?.status === 'stopped') return { label: 'Session stopped', tone: 'danger', restatesColumn: false };
  if (run?.status === 'blocked') return { label: 'Waiting on you', tone: 'attention', restatesColumn: false };

  if (phase === 'attention') return { label: 'Ended without a PR', tone: 'attention', restatesColumn: false };
  if (phase === 'merged') return { label: 'Merged', tone: 'success', restatesColumn: true };
  if (phase === 'closed') return { label: 'Closed without a PR', tone: 'neutral', restatesColumn: false };
  if (run && isRunWorking(run.status)) {
    return { label: LIVE_PHASE_LABELS[phase] ?? 'Working', tone: 'active', restatesColumn: true };
  }
  // A reset card goes back to the backlog even when GitHub has closed the issue behind it.
  if (phase === 'backlog' && card.issue.state === 'closed') {
    return { label: 'Closed on GitHub', tone: 'neutral', restatesColumn: false };
  }
  return null;
}

export type AttentionKind = 'failed-checks' | 'failed' | 'stopped' | 'blocked' | 'stalled';

export interface AttentionSummary {
  kind: AttentionKind;
  /** Ordering weight: failures first, then things waiting on the user, then stalled sessions. */
  rank: number;
  reason: string;
  action: 'view-pr' | 'reply' | 'reset';
}

export function attentionSummary(card: CardDto): AttentionSummary {
  const failing = failingChecks(card);
  if (failing > 0) {
    return {
      kind: 'failed-checks',
      rank: 0,
      reason: `${failing} GitHub Actions check${failing === 1 ? '' : 's'} failing on the pull request`,
      action: 'view-pr',
    };
  }
  if (card.run?.status === 'failed') {
    return {
      kind: 'failed',
      rank: 1,
      reason: card.run.statusDetail ?? card.run.error ?? 'The Devin session failed',
      action: 'reset',
    };
  }
  if (card.run?.status === 'stopped') {
    return { kind: 'stopped', rank: 2, reason: 'The session was stopped before it finished', action: 'reset' };
  }
  if (card.run?.status === 'blocked') {
    return {
      kind: 'blocked',
      rank: 3,
      reason: card.run.statusDetail ?? 'Devin is waiting for your answer',
      action: 'reply',
    };
  }
  return { kind: 'stalled', rank: 4, reason: 'The session ended without opening a pull request', action: 'reset' };
}
