import { beforeEach, describe, expect, it } from 'vitest';
import type { IssueDto, PullRequestDto, RunDto } from '../../../shared/types.js';
import { createDb, setDb } from '../db/index.js';
import { upsertIssue } from '../store/issues.js';
import { upsertCheck, upsertPullRequest } from '../store/pullRequests.js';
import { createRun, updateRun } from '../store/runs.js';
import { buildCards, buildMetrics, resolvePhase } from './board.js';

const issue: IssueDto = {
  number: 1,
  repo: 'john-vh/superset',
  title: 'Flask vulnerability',
  body: 'Upgrade Flask',
  state: 'open',
  labels: ['security'],
  author: 'john-vh',
  url: 'https://github.com/john-vh/superset/issues/1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const run: RunDto = {
  id: 'run-1',
  issueNumber: 1,
  sessionId: 'devin-1',
  sessionUrl: null,
  phase: 'implementing',
  status: 'running',
  statusDetail: null,
  acus: 1.5,
  error: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:10:00.000Z',
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
  createdAt: '2026-01-01T00:30:00.000Z',
  updatedAt: '2026-01-01T00:30:00.000Z',
};

describe('resolvePhase', () => {
  it('keeps undispatched open issues in the backlog', () => {
    expect(resolvePhase(issue, null, null)).toBe('backlog');
  });

  it('follows the run phase while Devin is working', () => {
    expect(resolvePhase(issue, run, null)).toBe('implementing');
  });

  it('moves to review once a pull request is open', () => {
    expect(resolvePhase(issue, run, pr)).toBe('review');
  });

  it('flags failing checks and failed runs for attention', () => {
    const failingPr: PullRequestDto = {
      ...pr,
      checks: [{ id: '1', prNumber: 10, name: 'lint', state: 'failure', url: null, updatedAt: pr.updatedAt }],
    };
    expect(resolvePhase(issue, run, failingPr)).toBe('attention');
    expect(resolvePhase(issue, { ...run, status: 'failed' }, null)).toBe('attention');
  });

  it('treats a finished run without a pull request as needing attention', () => {
    expect(resolvePhase(issue, { ...run, status: 'finished' }, null)).toBe('attention');
  });

  it('is merged only once the pull request actually merges', () => {
    expect(resolvePhase(issue, run, { ...pr, merged: true, state: 'closed' })).toBe('merged');
  });

  it('keeps an open pull request in review after the session ends', () => {
    expect(resolvePhase(issue, { ...run, status: 'finished' }, pr)).toBe('review');
    expect(resolvePhase(issue, { ...run, status: 'stopped' }, pr)).toBe('review');
    expect(resolvePhase({ ...issue, state: 'closed' }, { ...run, status: 'finished' }, pr)).toBe('review');
  });

  it('marks an issue closed without a pull request as closed, not merged', () => {
    expect(resolvePhase({ ...issue, state: 'closed' }, null, null)).toBe('closed');
    expect(resolvePhase({ ...issue, state: 'closed' }, { ...run, status: 'finished' }, null)).toBe('closed');
  });

  it('flags a stopped run for attention', () => {
    expect(resolvePhase(issue, { ...run, status: 'stopped' }, null)).toBe('attention');
  });
});

describe('board aggregation', () => {
  beforeEach(() => {
    setDb(createDb(':memory:'));
  });

  it('builds one card per issue with its latest run and pull request', () => {
    upsertIssue(issue);
    const created = createRun(issue.number);
    updateRun(created.id, { phase: 'validating', status: 'running', acus: 2 });
    const prCreatedAt = new Date(Date.parse(created.createdAt) + 30 * 60_000).toISOString();
    upsertPullRequest({ ...pr, runId: created.id, createdAt: prCreatedAt, updatedAt: prCreatedAt });
    upsertCheck({ id: 'c1', prNumber: pr.number, name: 'tests', state: 'success', url: null });

    const cards = buildCards();
    expect(cards).toHaveLength(1);
    expect(cards[0]?.phase).toBe('review');
    expect(cards[0]?.pullRequest?.checks[0]?.state).toBe('success');

    const metrics = buildMetrics(cards);
    expect(metrics).toMatchObject({ issuesOpen: 1, runsActive: 1, prsOpen: 1, checksPassing: 1, acusConsumed: 2 });
    expect(metrics.medianTimeToPrMs).toBeGreaterThan(0);
    expect(metrics.estimatedCostUsd).toBe(Number((2 * (metrics.acuRateUsd ?? 0)).toFixed(2)));
  });

  it('leaves updated_at alone when a poll reports no change', async () => {
    upsertIssue(issue);
    const created = createRun(issue.number);
    updateRun(created.id, { status: 'running' });
    const settled = buildCards()[0]?.run?.updatedAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    updateRun(created.id, { status: 'running' });

    expect(buildCards()[0]?.run?.updatedAt).toBe(settled);
  });
});
