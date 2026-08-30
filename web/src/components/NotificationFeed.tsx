import type { NotificationDto } from '@shared/types';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatRelative } from '@/lib/utils';

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

/** Highest-severity level in the unseen notifications, used to colour the bell. */
function alertTone(notifications: NotificationDto[]): 'danger' | 'warning' | 'active' {
  if (notifications.some((notification) => notification.level === 'error')) return 'danger';
  if (notifications.some((notification) => notification.level === 'warning')) return 'warning';
  return 'active';
}

export function NotificationFeed({ notifications, onClear }: NotificationFeedProps) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState<NotificationDto[]>([]);
  const seenId = useRef<string | null>(null);

  useEffect(() => {
    if (open) {
      seenId.current = notifications.at(0)?.id ?? null;
      setUnseen([]);
      return;
    }
    const index = notifications.findIndex((notification) => notification.id === seenId.current);
    setUnseen(index === -1 ? notifications : notifications.slice(0, index));
  }, [notifications, open]);

  const tone = alertTone(unseen);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className={cn(
            'relative',
            unseen.length > 0 && tone === 'danger' && 'border-danger/60 bg-danger/15 text-danger',
            unseen.length > 0 && tone === 'warning' && 'border-warning/60 bg-warning/15 text-warning',
            unseen.length > 0 && tone === 'active' && 'border-active/60 bg-active/15 text-active',
          )}
        >
          <Bell size={13} className={unseen.length > 0 ? 'animate-bounce' : undefined} />
          Activity
          {unseen.length > 0 ? (
            <span
              className={cn(
                'ml-0.5 rounded-full px-1.5 text-[10px] font-semibold text-canvas',
                tone === 'danger' && 'bg-danger',
                tone === 'warning' && 'bg-warning',
                tone === 'active' && 'bg-active',
              )}
            >
              {unseen.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80">
        <header className="flex items-center justify-between border-b border-line px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Activity</h2>
          {notifications.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear
            </Button>
          ) : null}
        </header>
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
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
      </PopoverContent>
    </Popover>
  );
}
