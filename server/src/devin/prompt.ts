import type { IssueDto } from '../../../shared/types.js';
import { config, githubRepo } from '../config.js';

export interface PromptContext {
  issue: IssueDto;
  runId: string;
}

/**
 * Inline fallback for the playbook: the session reports its phase back to the board so
 * cards move even when a playbook is not configured.
 */
export function buildPrompt({ issue, runId }: PromptContext): string {
  const callbackUrl = `${config.APP_BASE_URL.replace(/\/$/, '')}/api/devin/callback`;

  return [
    `Fix issue #${issue.number} in ${githubRepo.fullName}.`,
    '',
    `Title: ${issue.title}`,
    `URL: ${issue.url}`,
    issue.labels.length > 0 ? `Labels: ${issue.labels.join(', ')}` : '',
    '',
    'Issue body:',
    issue.body || '(empty)',
    '',
    'Requirements:',
    `1. Investigate the issue, implement a minimal focused fix, and open a pull request whose body contains "Fixes #${issue.number}".`,
    '2. Run the repository lint, typecheck and test commands before opening the PR.',
    '3. Report progress to the automation board by POSTing to the callback below as you enter each phase.',
    '',
    'Phase callback (curl):',
    '```',
    `curl -sS -X POST ${callbackUrl} \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -H 'X-Callback-Token: ${config.CALLBACK_TOKEN}' \\`,
    `  -d '{"run_id":"${runId}","phase":"investigating","message":"short status"}'`,
    '```',
    '',
    'Valid phases in order: investigating, implementing, validating, review, done.',
    'Send "review" immediately after the PR is opened, including the PR number as "pr_number".',
    'If you become blocked, send phase "attention" with an explanation in "message".',
  ]
    .filter((line) => line !== '')
    .join('\n');
}
