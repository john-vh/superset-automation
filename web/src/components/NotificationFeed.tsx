import type { CardDto, NotificationDto } from '@shared/types';
import { Bell, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, formatRelative } from '@/lib/utils';

const LEVEL_BORDERS: Record<NotificationDto['level'], string> = {
  info: 'border-l-line-strong',
  success: 'border-l-success',
  warning: 'border-l-attention',
  error: 'border-l-danger',
};

export interface NotificationFeedProps {
  notifications: NotificationDto[];
  /** Board cards supply the issue title, so a renamed issue reads correctly in old activity. */
  cards: CardDto[];
  onClear: () => void;
  onDismiss: (id: string) => void;
}

/** Highest-severity level in the unseen notifications, used to colour the bell. */
function alertTone(notifications: NotificationDto[]): 'danger' | 'attention' | 'active' {
  if (notifications.some((notification) => notification.level === 'error')) return 'danger';
  if (notifications.some((notification) => notification.level === 'warning')) return 'attention';
  return 'active';
}

export function NotificationFeed({ notifications, cards, onClear, onDismiss }: NotificationFeedProps) {
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

  const titles = useMemo(
    () => new Map(cards.map((card) => [card.issue.number, card.issue.title])),
    [cards],
  );

  const tone = alertTone(unseen);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className={cn(
            'relative',
            unseen.length > 0 && tone === 'danger' && 'border-danger/60 bg-danger/15 text-danger',
            unseen.length > 0 && tone === 'attention' && 'border-attention/60 bg-attention/15 text-attention',
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
                tone === 'attention' && 'bg-attention',
                tone === 'active' && 'bg-active',
              )}
            >
              {unseen.length}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96">
        <header className="flex items-center justify-between border-b border-line px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Activity</h2>
          {notifications.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear all
            </Button>
          ) : null}
        </header>
        <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
          {notifications.length === 0 ? (
            <p className="px-1 py-6 text-center text-[11px] text-faint">No activity yet</p>
          ) : (
            notifications.map((notification) => {
              const title = notification.issueNumber === null ? null : titles.get(notification.issueNumber);
              return (
                <div
                  key={notification.id}
                  className={cn(
                    'rounded-md border border-line border-l-2 bg-surface-raised p-2',
                    LEVEL_BORDERS[notification.level],
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-xs text-text">{notification.title}</p>
                    <button
                      type="button"
                      aria-label="Dismiss activity"
                      className="shrink-0 text-faint transition-colors hover:text-text"
                      onClick={() => onDismiss(notification.id)}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  {title ? (
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      #{notification.issueNumber} {title}
                    </p>
                  ) : null}
                  {notification.body ? <p className="mt-1 text-[11px] text-muted">{notification.body}</p> : null}
                  <p className="mt-1 text-[10px] text-faint">{formatRelative(notification.createdAt)}</p>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
