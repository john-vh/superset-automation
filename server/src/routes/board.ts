import { Router } from 'express';
import { publishBoard, subscribe } from '../events/bus.js';
import { buildBoard } from '../services/board.js';
import { DispatchError, dispatchIssue, resetIssue, stopIssueRun } from '../services/dispatch.js';
import { syncIssues } from '../services/issueSync.js';
import { pollActiveRuns } from '../services/sessionPoller.js';
import { getIssue } from '../store/issues.js';
import { clearNotifications } from '../store/notifications.js';
import { getPullRequestForIssue } from '../store/pullRequests.js';
import { getRun, listRunEvents } from '../store/runs.js';

export const boardRouter: Router = Router();

boardRouter.get('/board', (_req, res) => {
  res.json(buildBoard());
});

boardRouter.get('/runs/:id', (req, res) => {
  const run = getRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: 'Run not found' });
    return;
  }
  const issue = getIssue(run.issueNumber);
  if (!issue) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }
  res.json({
    run,
    issue,
    events: listRunEvents(run.id),
    pullRequest: getPullRequestForIssue(run.issueNumber),
  });
});

boardRouter.post('/issues/:number/dispatch', async (req, res) => {
  const issueNumber = Number(req.params.number);
  if (!Number.isInteger(issueNumber)) {
    res.status(400).json({ error: 'Issue number must be an integer' });
    return;
  }

  try {
    const run = await dispatchIssue(issueNumber);
    res.status(202).json({ run });
  } catch (error) {
    if (error instanceof DispatchError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Dispatch failed' });
  }
});

boardRouter.post('/issues/:number/stop', async (req, res) => {
  const issueNumber = Number(req.params.number);
  if (!Number.isInteger(issueNumber)) {
    res.status(400).json({ error: 'Issue number must be an integer' });
    return;
  }

  try {
    res.json({ run: await stopIssueRun(issueNumber) });
  } catch (error) {
    if (error instanceof DispatchError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(502).json({ error: error instanceof Error ? error.message : 'Stop failed' });
  }
});

boardRouter.post('/issues/:number/reset', async (req, res) => {
  const issueNumber = Number(req.params.number);
  if (!Number.isInteger(issueNumber)) {
    res.status(400).json({ error: 'Issue number must be an integer' });
    return;
  }

  try {
    await resetIssue(issueNumber);
    res.status(204).end();
  } catch (error) {
    if (error instanceof DispatchError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error instanceof Error ? error.message : 'Reset failed' });
  }
});

boardRouter.post('/sync', async (req, res) => {
  try {
    const result = await syncIssues({ full: req.query.full === 'true' });
    await pollActiveRuns();
    publishBoard();
    res.json(result);
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : 'Sync failed' });
  }
});

boardRouter.delete('/notifications', (_req, res) => {
  clearNotifications();
  publishBoard();
  res.status(204).end();
});

boardRouter.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const send = (payload: unknown) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  send({ type: 'board', board: buildBoard() });

  const unsubscribe = subscribe(send);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
