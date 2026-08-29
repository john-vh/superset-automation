import { describe, expect, it } from 'vitest';
import { linkedIssueNumber, mapCheckState } from './checks.js';

describe('mapCheckState', () => {
  it('maps GitHub statuses and conclusions to board states', () => {
    expect(mapCheckState({ status: 'queued', conclusion: null })).toBe('queued');
    expect(mapCheckState({ status: 'in_progress', conclusion: null })).toBe('in_progress');
    expect(mapCheckState({ status: 'completed', conclusion: 'success' })).toBe('success');
    expect(mapCheckState({ status: 'completed', conclusion: 'timed_out' })).toBe('failure');
    expect(mapCheckState({ status: 'completed', conclusion: 'skipped' })).toBe('skipped');
    expect(mapCheckState({ status: 'completed', conclusion: 'stale' })).toBe('neutral');
  });
});

describe('linkedIssueNumber', () => {
  it('finds closing keywords and bare references', () => {
    expect(linkedIssueNumber('Fixes #42')).toBe(42);
    expect(linkedIssueNumber('This closes #7 for good')).toBe(7);
    expect(linkedIssueNumber('Related to #13')).toBe(13);
    expect(linkedIssueNumber('No references here')).toBeNull();
  });
});
