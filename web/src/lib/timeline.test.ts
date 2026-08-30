import type { RunEventDto } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { isTimelineEvent } from './timeline';

function event(overrides: Partial<RunEventDto>): RunEventDto {
  return {
    id: 1,
    runId: 'run-1',
    kind: 'system',
    source: 'devin',
    phase: null,
    message: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('isTimelineEvent', () => {
  it('keeps phase changes, PR news, errors and terminal statuses', () => {
    expect(isTimelineEvent(event({ kind: 'phase', phase: 'implementing', message: 'Implementing' }))).toBe(true);
    expect(isTimelineEvent(event({ message: 'PR #10 was merged' }))).toBe(true);
    expect(isTimelineEvent(event({ kind: 'error', message: 'Session failed' }))).toBe(true);
    expect(isTimelineEvent(event({ message: 'Session status: finished' }))).toBe(true);
  });

  it('drops repeated poll status lines and raw session chatter', () => {
    expect(isTimelineEvent(event({ message: 'Session status: running · working' }))).toBe(false);
    expect(isTimelineEvent(event({ kind: 'message', message: 'Looking at the lockfile now' }))).toBe(false);
  });
});
