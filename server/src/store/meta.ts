import { db } from '../db/index.js';

export function getMeta(key: string): string | null {
  const row = db().prepare('SELECT value FROM meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setMeta(key: string, value: string): void {
  db()
    .prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}

const RESET_KEY_PREFIX = 'issue_reset:';

/**
 * A reset issue is treated as never dispatched, so its card returns to the backlog even when the
 * issue itself is closed on GitHub. Dispatching clears the marker.
 */
export function markIssueReset(issueNumber: number, at: string): void {
  setMeta(`${RESET_KEY_PREFIX}${issueNumber}`, at);
}

export function clearIssueReset(issueNumber: number): void {
  db().prepare('DELETE FROM meta WHERE key = ?').run(`${RESET_KEY_PREFIX}${issueNumber}`);
}

export function isIssueReset(issueNumber: number): boolean {
  return getMeta(`${RESET_KEY_PREFIX}${issueNumber}`) !== null;
}

/** Returns false when the delivery was already processed. */
export function recordDelivery(deliveryId: string, receivedAt: string): boolean {
  const result = db()
    .prepare('INSERT OR IGNORE INTO webhook_deliveries (id, received_at) VALUES (?, ?)')
    .run(deliveryId, receivedAt);
  return result.changes > 0;
}
