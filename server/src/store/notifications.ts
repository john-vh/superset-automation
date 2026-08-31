import { randomUUID } from 'node:crypto';
import type { NotificationDto } from '../../../shared/types.js';
import { db, nowIso } from '../db/index.js';
import { toNotificationDto, type NotificationRow } from './rows.js';

export interface NotificationInput {
  level: NotificationDto['level'];
  title: string;
  body?: string;
  issueNumber?: number | null;
}

export function addNotification(input: NotificationInput): NotificationDto {
  const id = randomUUID();
  db()
    .prepare(
      `INSERT INTO notifications (id, level, title, body, issue_number, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.level, input.title, input.body ?? '', input.issueNumber ?? null, nowIso());

  const row = db().prepare('SELECT * FROM notifications WHERE id = ?').get(id) as NotificationRow;
  return toNotificationDto(row);
}

export function listNotifications(limit = 30): NotificationDto[] {
  const rows = db()
    .prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?')
    .all(limit) as NotificationRow[];
  return rows.map(toNotificationDto);
}

export function deleteNotification(id: string): boolean {
  return db().prepare('DELETE FROM notifications WHERE id = ?').run(id).changes > 0;
}

export function clearNotifications(): void {
  db().prepare('DELETE FROM notifications').run();
}
