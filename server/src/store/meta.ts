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

/** Returns false when the delivery was already processed. */
export function recordDelivery(deliveryId: string, receivedAt: string): boolean {
  const result = db()
    .prepare('INSERT OR IGNORE INTO webhook_deliveries (id, received_at) VALUES (?, ?)')
    .run(deliveryId, receivedAt);
  return result.changes > 0;
}
