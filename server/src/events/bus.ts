import { EventEmitter } from 'node:events';
import type { NotificationDto, StreamEvent } from '../../../shared/types.js';
import { buildBoard } from '../services/board.js';
import { addNotification, type NotificationInput } from '../store/notifications.js';

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

const CHANNEL = 'stream';

export function subscribe(listener: (event: StreamEvent) => void): () => void {
  emitter.on(CHANNEL, listener);
  return () => emitter.off(CHANNEL, listener);
}

export function publishBoard(): void {
  emitter.emit(CHANNEL, { type: 'board', board: buildBoard() } satisfies StreamEvent);
}

export function publishNotification(input: NotificationInput): NotificationDto {
  const notification = addNotification(input);
  emitter.emit(CHANNEL, { type: 'notification', notification } satisfies StreamEvent);
  publishBoard();
  return notification;
}
