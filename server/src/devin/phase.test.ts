import { describe, expect, it } from 'vitest';
import { inferPhase, mapSessionStatus } from './phase.js';

describe('mapSessionStatus', () => {
  it('maps Devin session statuses onto run statuses', () => {
    expect(mapSessionStatus('new')).toBe('pending');
    expect(mapSessionStatus('running')).toBe('running');
    expect(mapSessionStatus('suspended')).toBe('blocked');
    expect(mapSessionStatus('error')).toBe('failed');
    expect(mapSessionStatus('exit')).toBe('finished');
    expect(mapSessionStatus(null)).toBe('pending');
  });
});

describe('inferPhase', () => {
  it('derives a phase from session chatter and returns null when unclear', () => {
    expect(inferPhase('Opened a pull request with the fix')).toBe('review');
    expect(inferPhase('Running the test suite now')).toBe('validating');
    expect(inferPhase('hello there')).toBeNull();
  });
});
