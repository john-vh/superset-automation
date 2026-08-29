import type { CardDto } from '@shared/types';
import { Play, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Board } from '@/components/board/Board';
import { MetricsHeader } from '@/components/MetricsHeader';
import { NotificationFeed } from '@/components/NotificationFeed';
import { RunDrawer } from '@/components/RunDrawer';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useBoard } from '@/lib/useBoard';
import { cn, formatRelative } from '@/lib/utils';

export function App() {
  const { board, connected, error, refresh } = useBoard();
  const [dispatching, setDispatching] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const selectedCard = useMemo<CardDto | null>(
    () => board?.cards.find((card) => card.issue.number === selected) ?? null,
    [board, selected],
  );

  const onDispatch = useCallback(
    async (issueNumber: number) => {
      setDispatching(issueNumber);
      setActionError(null);
      try {
        await api.dispatch(issueNumber);
        await refresh();
      } catch (cause) {
        setActionError(cause instanceof Error ? cause.message : 'Dispatch failed');
      } finally {
        setDispatching(null);
      }
    },
    [refresh],
  );

  const backlog = useMemo(
    () => board?.cards.filter((card) => card.phase === 'backlog') ?? [],
    [board],
  );

  /** Bulk start: one independent Devin session per backlog issue, dispatched in sequence. */
  const onDispatchBacklog = useCallback(async () => {
    for (const card of backlog) {
      await onDispatch(card.issue.number);
    }
  }, [backlog, onDispatch]);

  const onSync = useCallback(async () => {
    setSyncing(true);
    setActionError(null);
    try {
      await api.sync();
      await refresh();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [refresh]);

  const integrations = board?.integrations;

  return (
    <div className="min-h-full px-5 py-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-text">Superset Automation</h1>
          <p className="text-xs text-muted">
            {board?.repo ?? 'loading…'}
            {integrations?.lastIssueSyncAt ? ` · synced ${formatRelative(integrations.lastIssueSyncAt)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'bg-success' : 'bg-danger')} />
            {connected ? 'live' : 'reconnecting'}
          </span>
          <Button
            variant="primary"
            size="sm"
            disabled={backlog.length === 0 || dispatching !== null || !integrations?.devinConfigured}
            onClick={() => void onDispatchBacklog()}
          >
            <Play size={12} />
            Start backlog ({backlog.length})
          </Button>
          <Button size="sm" onClick={() => void onSync()} disabled={syncing}>
            <RefreshCw size={12} className={syncing ? 'animate-spin' : undefined} />
            Sync issues
          </Button>
        </div>
      </header>

      {integrations && !integrations.devinConfigured ? (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Devin is not configured — set DEVIN_API_KEY and DEVIN_ORG_ID in .env to dispatch sessions.
        </p>
      ) : null}
      {integrations && !integrations.githubTokenConfigured ? (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          GITHUB_TOKEN is not set — issue sync and CI check tracking are disabled.
        </p>
      ) : null}
      {error || actionError ? (
        <p className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {actionError ?? error}
        </p>
      ) : null}

      {board ? (
        <div className="space-y-4">
          <MetricsHeader metrics={board.metrics} />
          <div className="flex gap-4">
            <div className="min-w-0 flex-1">
              <Board
                cards={board.cards}
                dispatching={dispatching}
                canDispatch={board.integrations.devinConfigured}
                onDispatch={(issueNumber) => void onDispatch(issueNumber)}
                onOpen={(card) => setSelected(card.issue.number)}
              />
            </div>
            <NotificationFeed
              notifications={board.notifications}
              onClear={() => void api.clearNotifications().then(refresh)}
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">Loading board…</p>
      )}

      <RunDrawer card={selectedCard} onClose={() => setSelected(null)} />
    </div>
  );
}
