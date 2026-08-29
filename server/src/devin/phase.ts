import type { Phase, RunStatus } from '../../../shared/types.js';

const STATUS_MAP: Record<string, RunStatus> = {
  new: 'pending',
  claimed: 'pending',
  resuming: 'running',
  running: 'running',
  working: 'running',
  suspended: 'blocked',
  blocked: 'blocked',
  expired: 'failed',
  error: 'failed',
  exit: 'finished',
  finished: 'finished',
  stopped: 'finished',
};

export function mapSessionStatus(status: string | null): RunStatus {
  if (!status) return 'pending';
  return STATUS_MAP[status.toLowerCase()] ?? 'running';
}

const PHASE_HINTS: Array<{ phase: Phase; patterns: RegExp[] }> = [
  { phase: 'review', patterns: [/opened? (?:a )?pull request/i, /\/pull\/\d+/i, /pr is (?:up|open)/i] },
  { phase: 'validating', patterns: [/running (?:the )?tests?/i, /\btypecheck\b/i, /\blint(ing)?\b/i, /\bci\b/i] },
  { phase: 'implementing', patterns: [/implement/i, /writing the fix/i, /editing/i, /patch/i, /commit/i] },
  { phase: 'investigating', patterns: [/investigat/i, /reading/i, /explor/i, /reproduc/i, /planning/i] },
];

/** Best-effort phase guess from session chatter, used when no callback has arrived. */
export function inferPhase(text: string): Phase | null {
  for (const hint of PHASE_HINTS) {
    if (hint.patterns.some((pattern) => pattern.test(text))) return hint.phase;
  }
  return null;
}
