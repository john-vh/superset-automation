import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DevinClient from '../devin/client.js';
import type { DevinSessionDetail } from '../devin/client.js';
import { createDb, setDb } from '../db/index.js';
import { upsertIssue } from '../store/issues.js';
import { createRun, getRun, updateRun } from '../store/runs.js';
import { pollRun, runsToPoll } from './sessionPoller.js';

const { getSession, getSessionAcus, listMessages } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSessionAcus: vi.fn(),
  listMessages: vi.fn(),
}));

vi.mock('../devin/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof DevinClient>();
  return { ...actual, getSession, getSessionAcus, listMessages };
});

function sessionDetail(overrides: Partial<DevinSessionDetail> = {}): DevinSessionDetail {
  return {
    session_id: 'devin-1',
    status: 'running',
    status_detail: 'working',
    title: null,
    url: null,
    acus_consumed: null,
    pull_requests: [],
    structured_output: null,
    ...overrides,
  };
}

function dispatchedRun() {
  upsertIssue({
    number: 1,
    repo: 'john-vh/superset',
    title: 'Flask vulnerability',
    body: 'Upgrade Flask',
    state: 'open',
    labels: [],
    author: 'john-vh',
    url: 'https://github.com/john-vh/superset/issues/1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const run = createRun(1);
  return updateRun(run.id, { sessionId: 'devin-1', status: 'running' })!;
}

describe('session poller ACU accounting', () => {
  beforeEach(() => {
    setDb(createDb(':memory:'));
    vi.clearAllMocks();
    listMessages.mockResolvedValue({ messages: [], cursor: null });
    getSessionAcus.mockResolvedValue(null);
  });

  it('records the ACUs the session reports', async () => {
    const run = dispatchedRun();
    getSession.mockResolvedValue(sessionDetail({ acus_consumed: 2.5 }));

    await pollRun(run);

    expect(getRun(run.id)?.acus).toBe(2.5);
  });

  it('never lets a lagging poll erase ACUs already recorded', async () => {
    const run = dispatchedRun();
    getSession.mockResolvedValue(sessionDetail({ acus_consumed: 4 }));
    await pollRun(run);

    getSession.mockResolvedValue(sessionDetail({ acus_consumed: null }));
    await pollRun(getRun(run.id)!);

    expect(getRun(run.id)?.acus).toBe(4);
    expect(getSessionAcus).not.toHaveBeenCalled();
  });

  it('falls back to the consumption API when the session reports nothing', async () => {
    const run = dispatchedRun();
    getSession.mockResolvedValue(sessionDetail({ acus_consumed: null }));
    getSessionAcus.mockResolvedValue(1.75);

    await pollRun(run);

    expect(getSessionAcus).toHaveBeenCalledWith('devin-1');
    expect(getRun(run.id)?.acus).toBe(1.75);
  });

  it('keeps polling a just-finished run so its final total can land', () => {
    const run = dispatchedRun();
    updateRun(run.id, { status: 'finished', finishedAt: new Date().toISOString() });

    expect(runsToPoll().map((polled) => polled.id)).toContain(run.id);
  });

  it('stops polling a run that finished long ago', () => {
    const run = dispatchedRun();
    const longAgo = new Date(Date.now() - 60 * 60_000).toISOString();
    updateRun(run.id, { status: 'finished', finishedAt: longAgo });

    expect(runsToPoll()).toHaveLength(0);
  });
});
