import type { IssueDto } from '../../../shared/types.js';
import { db, nowIso } from '../db/index.js';
import { toIssueDto, type IssueRow } from './rows.js';

export interface IssueInput {
  number: number;
  repo: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  author: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export function upsertIssue(issue: IssueInput): IssueDto {
  db()
    .prepare(
      `INSERT INTO issues (number, repo, title, body, state, labels, author, url, created_at, updated_at, synced_at)
       VALUES (@number, @repo, @title, @body, @state, @labels, @author, @url, @created_at, @updated_at, @synced_at)
       ON CONFLICT(number) DO UPDATE SET
         repo = excluded.repo,
         title = excluded.title,
         body = excluded.body,
         state = excluded.state,
         labels = excluded.labels,
         author = excluded.author,
         url = excluded.url,
         updated_at = excluded.updated_at,
         synced_at = excluded.synced_at`,
    )
    .run({
      number: issue.number,
      repo: issue.repo,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: JSON.stringify(issue.labels),
      author: issue.author,
      url: issue.url,
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
      synced_at: nowIso(),
    });

  return getIssue(issue.number) as IssueDto;
}

export function getIssue(number: number): IssueDto | null {
  const row = db().prepare('SELECT * FROM issues WHERE number = ?').get(number) as IssueRow | undefined;
  return row ? toIssueDto(row) : null;
}

export function listIssues(): IssueDto[] {
  const rows = db().prepare('SELECT * FROM issues ORDER BY number DESC').all() as IssueRow[];
  return rows.map(toIssueDto);
}
