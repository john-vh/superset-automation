import type { CheckState, Phase } from '@shared/types';

type Tone = 'neutral' | 'active' | 'success' | 'warning' | 'danger' | 'info';

export const PHASE_TONES: Record<Phase, Tone> = {
  backlog: 'neutral',
  queued: 'neutral',
  investigating: 'active',
  implementing: 'active',
  validating: 'info',
  review: 'info',
  done: 'success',
  attention: 'warning',
};

export const CHECK_TONES: Record<CheckState, Tone> = {
  queued: 'neutral',
  in_progress: 'info',
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
