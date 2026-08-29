import type { NotificationDto } from '@shared/types';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelative } from '@/lib/utils';

const LEVEL_TONES = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'danger',
} as const;

export interface NotificationFeedProps {
  notifications: NotificationDto[];
  onClear: () => void;
}

export function NotificationFeed({ notifications, onClear }: NotificationFeedProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <Bell size={13} />Activity
        </h2>
        {notifications.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </header>
      <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-2">
        {notifications.length === 0 ? (
          <p className="px-1 py-6 text-center text-[11px] text-faint">No activity yet</p>
        ) : (
          notifications.map((notification) => (
            <div key={notification.id} className="rounded-md border border-line bg-surface-raised p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-text">{notification.title}</p>
                <Badge tone={LEVEL_TONES[notification.level]}>{notification.level}</Badge>
              </div>
              {notification.body ? <p className="mt-1 text-[11px] text-muted">{notification.body}</p> : null}
              <p className="mt-1 text-[10px] text-faint">{formatRelative(notification.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
