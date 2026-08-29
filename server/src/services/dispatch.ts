import type { RunDto } from '../../../shared/types.js';
import { config, devinConfigured, githubRepo } from '../config.js';
import { createSession } from '../devin/client.js';
import { buildPrompt } from '../devin/prompt.js';
import { publishBoard, publishNotification } from '../events/bus.js';
import { getIssue } from '../store/issues.js';
import { addRunEvent, createRun, getLatestRunForIssue, updateRun } from '../store/runs.js';

export class DispatchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'DispatchError';
  }
}

const ACTIVE_STATUSES = new Set(['pending', 'running', 'blocked']);

/**
 * Creates a Devin session for an issue. Refuses to start a second session while an
 * earlier one for the same issue is still active, so a double click is harmless.
 */
export async function dispatchIssue(issueNumber: number): Promise<RunDto> {
  const issue = getIssue(issueNumber);
  if (!issue) throw new DispatchError(`Issue #${issueNumber} is not on the board`, 404);
  if (!devinConfigured) throw new DispatchError('DEVIN_API_KEY and DEVIN_ORG_ID are not configured', 503);

  const existing = getLatestRunForIssue(issueNumber);
  if (existing && ACTIVE_STATUSES.has(existing.status)) {
    throw new DispatchError(`Issue #${issueNumber} already has an active Devin session`, 409);
  }

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
