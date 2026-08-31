import type { CheckState, PullRequestDto } from '../../../shared/types.js';
import { db, nowIso } from '../db/index.js';
import { toCheckDto, toPullRequestDto, type CheckRow, type PullRequestRow } from './rows.js';

export interface PullRequestInput {
  number: number;
  repo: string;
  title: string;
  url: string;
  state: 'open' | 'closed';
  merged: boolean;
  headSha?: string | null;
  issueNumber?: number | null;
  runId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function upsertPullRequest(input: PullRequestInput): PullRequestDto {
  const now = nowIso();
  db()
    .prepare(
      `INSERT INTO pull_requests
         (number, repo, issue_number, run_id, title, url, state, merged, head_sha, created_at, updated_at)
       VALUES (@number, @repo, @issue_number, @run_id, @title, @url, @state, @merged, @head_sha, @created_at, @updated_at)
       ON CONFLICT(number) DO UPDATE SET
         repo = excluded.repo,
         issue_number = COALESCE(excluded.issue_number, pull_requests.issue_number),
         run_id = COALESCE(excluded.run_id, pull_requests.run_id),
         title = excluded.title,
         url = excluded.url,
         state = excluded.state,
         merged = excluded.merged,
         head_sha = COALESCE(excluded.head_sha, pull_requests.head_sha),
         updated_at = excluded.updated_at`,
    )
    .run({
      number: input.number,
      repo: input.repo,
      issue_number: input.issueNumber ?? null,
      run_id: input.runId ?? null,
      title: input.title,
      url: input.url,
      state: input.state,
      merged: input.merged ? 1 : 0,
      head_sha: input.headSha ?? null,
      created_at: input.createdAt ?? now,
      updated_at: input.updatedAt ?? now,
    });

  return getPullRequest(input.number) as PullRequestDto;
}

export function getPullRequest(number: number): PullRequestDto | null {
  const row = db().prepare('SELECT * FROM pull_requests WHERE number = ?').get(number) as
    | PullRequestRow
    | undefined;
  return row ? toPullRequestDto(row, listChecks(row.number)) : null;
}

/**
 * Matches on the run as well as the issue link, so a pull request whose body never named the
 * issue — the link GitHub's closing keywords give us — still reaches its card.
 */
export function getPullRequestForIssue(issueNumber: number): PullRequestDto | null {
  const row = db()
    .prepare(
      `SELECT pr.* FROM pull_requests pr
         LEFT JOIN runs r ON r.id = pr.run_id
        WHERE pr.issue_number = @issue OR r.issue_number = @issue
        ORDER BY pr.number DESC LIMIT 1`,
    )
    .get({ issue: issueNumber }) as PullRequestRow | undefined;
  return row ? toPullRequestDto(row, listChecks(row.number)) : null;
}

/**
 * Detaches tracked pull requests from an issue; the PRs themselves are left on GitHub. Rows are
 * matched through the issue's runs too, so a PR that was never linked back to the issue still goes.
 */
export function deletePullRequestsForIssue(issueNumber: number): number {
  const result = db()
    .prepare(
      `DELETE FROM pull_requests
        WHERE issue_number = @issue
           OR run_id IN (SELECT id FROM runs WHERE issue_number = @issue)`,
    )
    .run({ issue: issueNumber });
  return result.changes;
}

export function listPullRequests(): PullRequestDto[] {
  const rows = db().prepare('SELECT * FROM pull_requests ORDER BY number DESC').all() as PullRequestRow[];
  return rows.map((row) => toPullRequestDto(row, listChecks(row.number)));
}

export function listChecks(prNumber: number) {
  const rows = db()
    .prepare('SELECT * FROM checks WHERE pr_number = ? ORDER BY name ASC')
    .all(prNumber) as CheckRow[];
  return rows.map(toCheckDto);
}

export interface CheckInput {
  id: string;
  prNumber: number;
  name: string;
  state: CheckState;
  url?: string | null;
}

export function upsertCheck(input: CheckInput): void {
  db()
    .prepare(
      `INSERT INTO checks (id, pr_number, name, state, url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         state = excluded.state,
         url = excluded.url,
         updated_at = excluded.updated_at`,
    )
    .run(input.id, input.prNumber, input.name, input.state, input.url ?? null, nowIso());
}
