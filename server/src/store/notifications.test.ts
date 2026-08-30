import { beforeEach, describe, expect, it } from 'vitest';
import { isRunWorking } from '../../../shared/board.js';
import { createDb, setDb } from '../db/index.js';
import { addNotification, clearNotifications, deleteNotification, listNotifications } from './notifications.js';

describe('notification store', () => {
  beforeEach(() => {
    setDb(createDb(':memory:'));
  });

  it('dismisses one notification without touching the rest', () => {
    const first = addNotification({ level: 'info', title: 'first' });
    addNotification({ level: 'info', title: 'second' });

    expect(deleteNotification(first.id)).toBe(true);
    expect(deleteNotification(first.id)).toBe(false);
    expect(listNotifications().map((n) => n.title)).toEqual(['second']);

    clearNotifications();
    expect(listNotifications()).toHaveLength(0);
  });
});

describe('isRunWorking', () => {
  it('is true only while Devin can still be interrupted', () => {
    expect(isRunWorking('pending')).toBe(true);
    expect(isRunWorking('running')).toBe(true);
    for (const status of ['blocked', 'finished', 'failed', 'stopped'] as const) {
      expect(isRunWorking(status)).toBe(false);
    }
  });
});
