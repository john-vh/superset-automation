import { TERMINAL_RUN_STATUSES, phaseRank } from '../../../shared/board.js';
import type { Phase, RunDto } from '../../../shared/types.js';
import { config, devinConfigured } from '../config.js';
import { getSession, listMessages, pullRequestUrl, type DevinSessionDetail } from '../devin/client.js';
import { inferPhase, mapSessionStatus } from '../devin/phase.js';
import { nowIso } from '../db/index.js';
import { publishBoard, publishNotification } from '../events/bus.js';
import { addRunEvent, getMessageCursor, listActiveRuns, updateRun } from '../store/runs.js';
import { pullRequestNumberFromUrl, trackPullRequest } from './prTracking.js';

function isTerminal(status: RunDto['status']): boolean {
  return TERMINAL_RUN_STATUSES.includes(status);
}

/** Phases only move forward; a stray message never drags a card backwards. */
function furthest(current: Phase, candidate: Phase | null): Phase {
  if (!candidate) return current;
  return phaseRank(candidate) > phaseRank(current) ? candidate : current;
}

async function ingestMessages(run: RunDto): Promise<Phase | null> {
  if (!run.sessionId) return null;

  const cursor = getMessageCursor(run.id);
  const page = await listMessages(run.sessionId, cursor);
  let latestPhase: Phase | null = null;

  for (const message of page.messages) {
    const phase = inferPhase(message.message);
    if (phase) latestPhase = phase;
    addRunEvent({
      runId: run.id,
      kind: 'message',
      phase,
      source: 'devin',
      message: message.message.slice(0, 2000),
      externalId: message.id,
    });
  }

  if (page.cursor !== cursor) updateRun(run.id, { messageCursor: page.cursor });
  return latestPhase;
}

function notifyStatusChange(run: RunDto, status: RunDto['status'], detail: DevinSessionDetail, prNumber: number | null): void {
  if (status === run.status) return;

  const reported = [detail.status, detail.status_detail].filter(Boolean).join(' · ');

  addRunEvent({
    runId: run.id,
    kind: status === 'failed' || status === 'stopped' ? 'error' : 'system',
    source: 'devin',
    message: status === 'finished' && prNumber ? `Session ended — PR #${prNumber} is with you` : `Session status: ${reported || status}`,
  });

  if (status === 'failed') {
    publishNotification({
      level: 'error',
      title: `Devin session failed for #${run.issueNumber}`,
      body: reported,
      issueNumber: run.issueNumber,
    });
  } else if (status === 'stopped') {
    publishNotification({
      level: 'error',
      title: `Devin session ended for #${run.issueNumber}`,
      body: reported || 'The session is no longer running.',
      issueNumber: run.issueNumber,
    });
  } else if (status === 'blocked') {
    publishNotification({
      level: 'warning',
      title: `Devin needs input on #${run.issueNumber}`,
      body: reported,
      issueNumber: run.issueNumber,
    });
  } else if (status === 'finished') {
    publishNotification({
      level: prNumber ? 'success' : 'warning',
      title: prNumber
        ? `PR #${prNumber} is ready for your review on issue #${run.issueNumber}`
        : `Devin finished #${run.issueNumber} without opening a PR`,
      issueNumber: run.issueNumber,
    });
  }
}

export async function pollRun(run: RunDto): Promise<void> {
  if (!run.sessionId) return;

  const detail = await getSession(run.sessionId);

  // Message ingestion is best-effort: a failure here must not stop the status from landing.
  let messagePhase: Phase | null = null;
  try {
    messagePhase = await ingestMessages(run);
  } catch (error) {
    console.error('[session-poller] message ingest failed:', error instanceof Error ? error.message : error);
  }

  const prNumber = pullRequestNumberFromUrl(pullRequestUrl(detail.pull_requests.at(0)));
  const pr = prNumber
    ? await trackPullRequest({ number: prNumber, issueNumber: run.issueNumber, runId: run.id })
    : null;

  // A session that ends while its PR is open handed the work over; that is the expected ending,
  // not a failure, so it must not be reported as an error or drop the card into attention.
  const handedOff = Boolean(pr && pr.state === 'open' && !pr.merged);
  const reported = mapSessionStatus(detail.status, detail.status_detail);
  const status = handedOff && reported === 'stopped' ? 'finished' : reported;

  let phase = furthest(run.phase, messagePhase);
  if (prNumber) phase = furthest(phase, 'review');
  if (!handedOff && (status === 'failed' || status === 'blocked' || status === 'stopped')) phase = 'attention';

  const terminal = isTerminal(status);
  updateRun(run.id, {
    status,
    phase,
    statusDetail: detail.status_detail ?? detail.status ?? null,
    acus: detail.acus_consumed ?? run.acus,
    sessionUrl: detail.url ?? run.sessionUrl,
    finishedAt: terminal ? (run.finishedAt ?? nowIso()) : null,
  });

  notifyStatusChange(run, status, detail, prNumber);
}

export async function pollActiveRuns(): Promise<void> {
  if (!devinConfigured) return;

  const runs = listActiveRuns().filter((run) => run.sessionId);
  if (runs.length === 0) return;

  for (const run of runs) {
    try {
      await pollRun(run);
    } catch (error) {
      console.error('[session-poller] failed:', error instanceof Error ? error.message : error);
    }
  }
  publishBoard();
}

export function startSessionPoller(): NodeJS.Timeout | null {
  if (!devinConfigured) return null;
  return setInterval(() => {
    void pollActiveRuns();
  }, config.SESSION_POLL_INTERVAL_MS);
}
