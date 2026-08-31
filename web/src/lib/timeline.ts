import type { RunEventDto } from '@shared/types';

/** Poll-driven status lines that repeat while nothing is actually changing. */
const ROUTINE_STATUS = /^Session status: (running|new|claimed|resuming)( ·|$)/i;

export function isSessionMessage(event: RunEventDto): boolean {
  return event.kind === 'message';
}

/**
 * The timeline should read as a list of things that happened — phase changes, the PR, checks,
 * errors, user actions — not as a transcript of every poll and every sentence Devin wrote.
 */
export function isTimelineEvent(event: RunEventDto): boolean {
  if (isSessionMessage(event)) return false;
  return !ROUTINE_STATUS.test(event.message);
}
