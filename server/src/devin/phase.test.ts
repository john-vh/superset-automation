import { describe, expect, it } from 'vitest';
import { inferPhase, mapSessionStatus } from './phase.js';

describe('mapSessionStatus', () => {
  it('maps Devin session statuses onto run statuses', () => {
    expect(mapSessionStatus('new')).toBe('pending');
    expect(mapSessionStatus('running')).toBe('running');
    expect(mapSessionStatus('suspended')).toBe('stopped');
    expect(mapSessionStatus('error')).toBe('failed');
    expect(mapSessionStatus('exit')).toBe('finished');
    expect(mapSessionStatus(null)).toBe('pending');
  });

  it('qualifies a running session with its status detail', () => {
    expect(mapSessionStatus('running', 'working')).toBe('running');
    expect(mapSessionStatus('running', 'waiting_for_user')).toBe('blocked');
    expect(mapSessionStatus('running', 'finished')).toBe('finished');
    expect(mapSessionStatus('running', 'out_of_credits')).toBe('failed');
  });

  it('treats going idle as a normal end rather than a stop', () => {
    expect(mapSessionStatus('suspended', 'inactivity')).toBe('finished');
    expect(mapSessionStatus('exit', 'inactivity')).toBe('finished');
  });
});

describe('inferPhase', () => {
  it('derives a phase from session chatter and returns null when unclear', () => {
    expect(inferPhase('Running the test suite now')).toBe('validating');
    expect(inferPhase('Committing the fix')).toBe('implementing');
    expect(inferPhase('hello there')).toBeNull();
  });

  it('never infers review, since talking about a pull request is not opening one', () => {
    expect(inferPhase('Next I will open a pull request with the fix')).toBeNull();
    expect(inferPhase('See https://github.com/acme/repo/pull/12 for context')).toBeNull();
  });
});
