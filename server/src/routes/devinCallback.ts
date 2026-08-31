import { Router } from 'express';
import { z } from 'zod';
import { CALLBACK_PHASES, normalizePhase } from '../../../shared/board.js';
import type { Phase } from '../../../shared/types.js';
import { config } from '../config.js';
import { publishBoard, publishNotification } from '../events/bus.js';
import { reportedPhase } from '../services/board.js';
import { trackPullRequest } from '../services/prTracking.js';
import { getPullRequestForIssue } from '../store/pullRequests.js';
import { addRunEvent, getRun, getRunBySession, updateRun } from '../store/runs.js';

export const devinCallbackRouter: Router = Router();

const REPORTABLE_PHASES: [Phase, ...Phase[]] = ['attention', ...CALLBACK_PHASES];

/** `done` is accepted for the published playbook; only a merged PR moves a card past review. */
const phaseSchema = z.enum([...REPORTABLE_PHASES, 'done'] as [string, ...string[]]).transform(normalizePhase);

const callbackSchema = z
  .object({
    run_id: z.string().optional(),
    session_id: z.string().optional(),
    phase: phaseSchema,
    message: z.string().max(2000).default(''),
    pr_number: z.coerce.number().int().positive().optional(),
  })
  .refine((value) => value.run_id ?? value.session_id, {
    message: 'run_id or session_id is required',
  });

devinCallbackRouter.post('/callback', async (req, res) => {
  if (req.header('x-callback-token') !== config.CALLBACK_TOKEN) {
    res.status(401).json({ error: 'Invalid callback token' });
    return;
  }

  const parsed = callbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payload', issues: parsed.error.issues });
    return;
  }

  const { run_id: runId, session_id: sessionId, phase, message, pr_number: prNumber } = parsed.data;
  const run = runId ? getRun(runId) : sessionId ? getRunBySession(sessionId) : null;
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }

  const pr = prNumber
    ? await trackPullRequest({ number: prNumber, issueNumber: run.issueNumber, runId: run.id })
    : getPullRequestForIssue(run.issueNumber);

  const reported: Phase = reportedPhase(phase, pr);

  updateRun(run.id, { phase: reported, status: reported === 'attention' ? 'blocked' : run.status });
  addRunEvent({ runId: run.id, kind: 'phase', phase: reported, source: 'devin', message });

  if (reported === 'attention') {
    publishNotification({
      level: 'warning',
      title: `Devin is blocked on #${run.issueNumber}`,
      body: message,
      issueNumber: run.issueNumber,
    });
  } else {
    publishBoard();
  }

  res.json({ status: 'ok', phase: reported });
});
