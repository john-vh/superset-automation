import type { RunDto } from '../../../shared/types.js';
import { config, devinConfigured, githubRepo } from '../config.js';
import { DevinError, createSession, terminateSession } from '../devin/client.js';
import { buildPrompt } from '../devin/prompt.js';
import { publishBoard, publishNotification } from '../events/bus.js';
import { getIssue } from '../store/issues.js';
import { deletePullRequestsForIssue } from '../store/pullRequests.js';
import { clearIssueReset, markIssueReset, retireAcus } from '../store/meta.js';
import {
  addRunEvent,
  createRun,
  deleteRunsForIssue,
  getLatestRunForIssue,
  sumRunAcusForIssue,
  updateRun,
} from '../store/runs.js';
import { nowIso } from '../db/index.js';
import { isRunActive } from '../../../shared/board.js';

export class DispatchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'DispatchError';
  }
}

/** Ends the running session for an issue and marks the run stopped. */
export async function stopIssueRun(issueNumber: number): Promise<RunDto> {
  const run = getLatestRunForIssue(issueNumber);
  if (!run) throw new DispatchError(`Issue #${issueNumber} has no Devin session`, 404);
  if (!isRunActive(run.status)) throw new DispatchError(`Session for #${issueNumber} is already over`, 409);

  if (run.sessionId) {
    try {
      await terminateSession(run.sessionId);
    } catch (error) {
      // A session Devin already ended is fine; anything else is a real failure.
      if (!(error instanceof DevinError) || error.status < 400 || error.status >= 500) throw error;
    }
  }

  const stopped = updateRun(run.id, {
    status: 'stopped',
    phase: 'attention',
    statusDetail: 'Stopped from the board',
    finishedAt: run.finishedAt ?? nowIso(),
  });

  addRunEvent({ runId: run.id, kind: 'error', source: 'user', message: 'Session stopped from the board' });
  publishNotification({
    level: 'error',
    title: `Devin session stopped for #${issueNumber}`,
    body: 'Reset the card to run it again.',
    issueNumber,
  });
  publishBoard();

  return stopped as RunDto;
}

/**
 * Clears every run and tracked pull request for an issue so the card returns to the backlog
 * and can be dispatched again. Intended for demos and for unsticking a stopped session.
 */
export async function resetIssue(issueNumber: number): Promise<void> {
  const issue = getIssue(issueNumber);
  if (!issue) throw new DispatchError(`Issue #${issueNumber} is not on the board`, 404);

  const run = getLatestRunForIssue(issueNumber);
  if (run && isRunActive(run.status) && run.sessionId) {
    try {
      await terminateSession(run.sessionId);
    } catch (error) {
      console.error('[reset] could not terminate session:', error instanceof Error ? error.message : error);
    }
  }

  deletePullRequestsForIssue(issueNumber);
  retireAcus(sumRunAcusForIssue(issueNumber));
  deleteRunsForIssue(issueNumber);
  markIssueReset(issueNumber, nowIso());

  publishNotification({
    level: 'info',
    title: `Reset #${issueNumber}`,
    body: 'Session history cleared; the issue is back in the backlog.',
    issueNumber,
  });
  publishBoard();
}

/**
 * Creates a Devin session for an issue. Refuses to start a second session while an
 * earlier one for the same issue is still active, so a double click is harmless.
 */
export async function dispatchIssue(issueNumber: number): Promise<RunDto> {
  const issue = getIssue(issueNumber);
  if (!issue) throw new DispatchError(`Issue #${issueNumber} is not on the board`, 404);
  if (!devinConfigured) throw new DispatchError('DEVIN_API_KEY and DEVIN_ORG_ID are not configured', 503);

  const existing = getLatestRunForIssue(issueNumber);
  if (existing && isRunActive(existing.status)) {
    throw new DispatchError(`Issue #${issueNumber} already has an active Devin session`, 409);
  }

  clearIssueReset(issueNumber);
  const run = createRun(issueNumber);
  addRunEvent({
    runId: run.id,
    kind: 'system',
    phase: 'queued',
    source: 'app',
    message: `Dispatching issue #${issueNumber} to Devin`,
  });
  publishBoard();

  try {
    const session = await createSession({
      prompt: buildPrompt({ issue, runId: run.id }),
      title: `${githubRepo.name} #${issue.number}: ${issue.title}`.slice(0, 120),
      playbookId: config.DEVIN_PLAYBOOK_ID ?? null,
      tags: ['superset-automation', `issue-${issue.number}`],
      maxAcuLimit: config.DEVIN_MAX_ACU ?? null,
    });

    const updated = updateRun(run.id, {
      sessionId: session.session_id,
      sessionUrl: session.url,
      status: 'running',
      phase: 'investigating',
    });

    addRunEvent({
      runId: run.id,
      kind: 'phase',
      phase: 'investigating',
      source: 'app',
      message: `Session ${session.session_id} started`,
    });
    publishNotification({
      level: 'info',
      title: `Devin started on #${issue.number}`,
      body: issue.title,
      issueNumber: issue.number,
    });

    return updated as RunDto;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateRun(run.id, { status: 'failed', phase: 'attention', error: message });
    addRunEvent({ runId: run.id, kind: 'error', source: 'app', message });
    publishNotification({
      level: 'error',
      title: `Could not start Devin for #${issue.number}`,
      body: message,
      issueNumber: issue.number,
    });
    throw new DispatchError(message, 502);
  }
}
