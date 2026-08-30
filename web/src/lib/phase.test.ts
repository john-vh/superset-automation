import type { CardDto, CheckDto, PullRequestDto, RunDto } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { statusPill } from './phase';

const run: RunDto = {
  id: 'run-1',
  issueNumber: 1,
  sessionId: 'devin-1',
  sessionUrl: null,
  phase: 'implementing',
  status: 'running',
  statusDetail: null,
  acus: 1,
  error: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  finishedAt: null,
};

const pr: PullRequestDto = {
  number: 10,
  repo: 'john-vh/superset',
  issueNumber: 1,
  runId: 'run-1',
  title: 'fix: bump Flask',
  url: 'https://github.com/john-vh/superset/pull/10',
  state: 'open',
  merged: false,
  headSha: 'abc',
  checks: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const failingCheck: CheckDto = {
  id: 'c1',
  prNumber: 10,
  name: 'lint',
  state: 'failure',
  url: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function card(overrides: Partial<CardDto> = {}): CardDto {
  return {
    issue: {
      number: 1,
      repo: 'john-vh/superset',
      title: 'Flask vulnerability',
      body: '',
      state: 'open',
      labels: [],
      author: 'john-vh',
      url: 'https://github.com/john-vh/superset/issues/1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    run: null,
    pullRequest: null,
    phase: 'backlog',
    needsAttention: false,
    ...overrides,
  };
}

describe('statusPill', () => {
  it('says nothing about an untouched backlog issue', () => {
    expect(statusPill(card())).toBeNull();
  });

  it('puts failing checks above everything else', () => {
    const pill = statusPill(
      card({ phase: 'attention', run, pullRequest: { ...pr, checks: [failingCheck] } }),
    );
    expect(pill).toMatchObject({ label: '1 check failing', tone: 'danger' });
  });

  it('keeps an open pull request a review hand-off however the session ended', () => {
    for (const status of ['finished', 'stopped', 'failed'] as const) {
      expect(statusPill(card({ phase: 'review', run: { ...run, status }, pullRequest: pr })))
        .toMatchObject({ label: 'Review & merge', tone: 'attention', restatesColumn: true });
    }
  });

  it('marks failed and stopped sessions without a pull request in red', () => {
    expect(statusPill(card({ phase: 'attention', run: { ...run, status: 'failed' } }))).toMatchObject({
      tone: 'danger',
    });
    expect(statusPill(card({ phase: 'attention', run: { ...run, status: 'stopped' } }))).toMatchObject({
      tone: 'danger',
    });
  });

  it('separates a merged pull request from an issue closed without one', () => {
    expect(statusPill(card({ phase: 'merged' }))).toMatchObject({ label: 'Merged', tone: 'success' });
    expect(statusPill(card({ phase: 'closed' }))).toMatchObject({
      label: 'Closed without a PR',
      tone: 'neutral',
    });
  });

  it('restates the column only for live work, review and merged', () => {
    expect(statusPill(card({ phase: 'implementing', run }))).toMatchObject({
      label: 'Implementing',
      tone: 'active',
      restatesColumn: true,
    });
  });
});
