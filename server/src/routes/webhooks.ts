import { Router, raw } from 'express';
import { config } from '../config.js';
import { publishBoard, publishNotification } from '../events/bus.js';
import { verifySignature } from '../github/signature.js';
import { nowIso } from '../db/index.js';
import { mapCheckState } from '../services/checks.js';
import { storeIssue } from '../services/issueSync.js';
import { trackPullRequest } from '../services/prTracking.js';
import type { GithubIssue } from '../github/client.js';
import { recordDelivery } from '../store/meta.js';
import { getPullRequest, upsertCheck } from '../store/pullRequests.js';

export const webhookRouter: Router = Router();

interface IssuePayload {
  action: string;
  issue: GithubIssue;
}

interface PullRequestPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    state: 'open' | 'closed';
    merged: boolean;
    body: string | null;
    head: { sha: string };
  };
}

interface CheckRunPayload {
  action: string;
  check_run: {
    id: number;
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: string | null;
    html_url: string | null;
    head_sha: string;
    pull_requests: Array<{ number: number }>;
  };
}

async function handleIssueEvent(payload: IssuePayload): Promise<void> {
  storeIssue(payload.issue);
  publishBoard();
}

async function handlePullRequestEvent(payload: PullRequestPayload): Promise<void> {
  const pr = payload.pull_request;
  const tracked = await trackPullRequest({
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    state: pr.state,
    merged: pr.merged,
    headSha: pr.head.sha,
    body: pr.body ?? '',
  });

  if (payload.action === 'closed' && pr.merged) {
    publishNotification({
      level: 'success',
      title: `PR #${pr.number} merged`,
      body: pr.title,
      issueNumber: tracked.issueNumber,
    });
  } else if (payload.action === 'opened') {
    publishNotification({
      level: 'info',
      title: `PR #${pr.number} opened`,
      body: pr.title,
      issueNumber: tracked.issueNumber,
    });
  } else {
    publishBoard();
  }
}

async function handleCheckRunEvent(payload: CheckRunPayload): Promise<void> {
  const run = payload.check_run;
  const state = mapCheckState(run);

  for (const { number } of run.pull_requests) {
    upsertCheck({ id: String(run.id), prNumber: number, name: run.name, state, url: run.html_url });

    if (state === 'failure') {
      const pr = getPullRequest(number);
      publishNotification({
        level: 'error',
        title: `CI failed on PR #${number}`,
        body: `${run.name} failed`,
        issueNumber: pr?.issueNumber ?? null,
      });
    } else {
      publishBoard();
    }
  }
}

webhookRouter.post('/github', raw({ type: '*/*' }), async (req, res) => {
  const body = req.body as Buffer;

  if (config.GITHUB_WEBHOOK_SECRET) {
    const signature = req.header('x-hub-signature-256');
    if (!verifySignature(config.GITHUB_WEBHOOK_SECRET, body, signature)) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
  }

  const deliveryId = req.header('x-github-delivery');
  if (deliveryId && !recordDelivery(deliveryId, nowIso())) {
    res.status(200).json({ status: 'duplicate' });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Body is not valid JSON' });
    return;
  }

  const event = req.header('x-github-event') ?? '';
  try {
    if (event === 'issues') await handleIssueEvent(payload as IssuePayload);
    else if (event === 'pull_request') await handlePullRequestEvent(payload as PullRequestPayload);
    else if (event === 'check_run') await handleCheckRunEvent(payload as CheckRunPayload);
  } catch (error) {
    console.error('[webhook] handler failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Handler failed' });
    return;
  }

  res.json({ status: 'ok', event });
});
