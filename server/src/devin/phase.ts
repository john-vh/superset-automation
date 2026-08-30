import type { Phase, RunStatus } from '../../../shared/types.js';

const STATUS_MAP: Record<string, RunStatus> = {
  new: 'pending',
  claimed: 'pending',
  resuming: 'running',
  running: 'running',
  working: 'running',
  suspended: 'stopped',
  blocked: 'blocked',
  expired: 'stopped',
  error: 'failed',
  exit: 'finished',
  finished: 'finished',
  stopped: 'stopped',
};

/** Reasons a suspended session is a failure rather than a deliberate stop. */
const FAILURE_DETAILS = new Set([
  'error',
  'out_of_credits',
  'out_of_quota',
  'no_quota_allocation',
  'payment_declined',
  'usage_limit_exceeded',
  'org_usage_limit_exceeded',
  'user_usage_limit_exceeded',
  'total_session_limit_exceeded',
]);

/**
 * Maps a Devin `status` (new, claimed, running, exit, error, suspended, resuming) to a run
 * status, using `status_detail` to tell a completed session apart from one that needs the
 * user, and a deliberate stop apart from a quota or platform failure.
 */
export function mapSessionStatus(status: string | null, detail: string | null = null): RunStatus {
  if (!status) return 'pending';
  const normalizedDetail = detail?.toLowerCase() ?? null;
  const mapped = STATUS_MAP[status.toLowerCase()] ?? 'running';

  if (normalizedDetail && FAILURE_DETAILS.has(normalizedDetail)) return 'failed';
  // Going idle is how a session normally ends once its work is handed over, not a stop.
  if (normalizedDetail === 'inactivity') return 'finished';
  if (mapped === 'running' && normalizedDetail === 'finished') return 'finished';
  if (mapped === 'running' && normalizedDetail?.startsWith('waiting_for_')) return 'blocked';
  return mapped;
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
