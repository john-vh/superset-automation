import { PHASE_LABELS, RUN_STATUS_LABELS, isRunWorking } from '@shared/board';
import type { CardDto, RunDetailDto, RunEventDto } from '@shared/types';
import { ExternalLink, GitPullRequest, RotateCcw, Sparkles, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CheckList } from '@/components/board/CheckList';
import { PhaseProgress } from '@/components/board/PhaseProgress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { api } from '@/lib/api';
import { PHASE_TONES, RUN_STATUS_TONES, statusPill } from '@/lib/phase';
import { isSessionMessage, isTimelineEvent } from '@/lib/timeline';
import { formatRelative } from '@/lib/utils';

const EVENT_TONES = {
  phase: 'active',
  message: 'neutral',
  system: 'neutral',
  error: 'danger',
} as const;

export interface RunDrawerProps {
  card: CardDto | null;
  busy: boolean;
  onStop: (issueNumber: number) => void;
  onReset: (issueNumber: number) => void;
  onClose: () => void;
}

export function RunDrawer({ card, busy, onStop, onReset, onClose }: RunDrawerProps) {
  const [detail, setDetail] = useState<RunDetailDto | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const runId = card?.run?.id ?? null;

  useEffect(() => {
    if (!runId) {
      setDetail(null);
      return;
    }
    let active = true;
    void api.runDetail(runId).then((next) => {
      if (active) setDetail(next);
    });
    return () => {
      active = false;
    };
  }, [runId, card?.run?.updatedAt]);

  if (!card) return null;
  const { issue, run, pullRequest } = card;
  const allEvents: RunEventDto[] = detail?.events ?? [];
  const events = showMessages ? allEvents : allEvents.filter(isTimelineEvent);
  const messageCount = allEvents.filter(isSessionMessage).length;
  const working = run ? isRunWorking(run.status) : false;
  const awaitingReview = pullRequest?.state === 'open' && !pullRequest.merged;
  const pill = statusPill(card);

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()} title={issue.title} description={`#${issue.number} · ${issue.repo}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PHASE_TONES[card.phase]}>{PHASE_LABELS[card.phase]}</Badge>
          {run && !awaitingReview ? (
            <Badge tone={RUN_STATUS_TONES[run.status]}>{RUN_STATUS_LABELS[run.status]}</Badge>
          ) : null}
          <a href={issue.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:text-text">
            Issue <ExternalLink size={11} />
          </a>
          {run?.sessionUrl ? (
            <a href={run.sessionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-active hover:underline">
              <Sparkles size={12} />Devin session
            </a>
          ) : null}
        </div>

        {run ? (
          <section className="space-y-2 rounded-lg border border-line bg-surface-raised p-3">
            <PhaseProgress phase={card.phase} tone={pill?.tone ?? PHASE_TONES[card.phase]} working={working} />
            <dl className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <dt className="text-faint">ACUs</dt>
                <dd className="text-text">{run.acus.toFixed(2)}</dd>
              </div>
              <div>
                <dt className="text-faint">Started</dt>
                <dd className="text-text">{formatRelative(run.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-faint">{run.finishedAt ? 'Ended' : 'Updated'}</dt>
                <dd className="text-text">{formatRelative(run.finishedAt ?? run.updatedAt)}</dd>
              </div>
            </dl>
            {run.statusDetail ? <p className="text-xs text-muted">{run.statusDetail}</p> : null}
            {run.error ? <p className="text-xs text-danger">{run.error}</p> : null}
            {!working && awaitingReview ? (
              <p className="text-xs text-attention">Session ended — the pull request is with you.</p>
            ) : null}
            {!working && !awaitingReview && (run.status === 'failed' || run.status === 'stopped') ? (
              <p className="text-xs text-danger">
                This session is over and is no longer making progress. Reset the issue to run it again.
              </p>
            ) : null}
          </section>
        ) : (
          <p className="text-xs text-muted">No Devin session has been started for this issue yet.</p>
        )}

        {run || pullRequest ? (
          <div className="flex flex-wrap gap-2">
            {working ? (
              <Button
                size="sm"
                disabled={busy}
                className="border-danger/50 text-danger hover:border-danger"
                onClick={() => onStop(issue.number)}
              >
                <Square size={12} />
                {busy ? 'Stopping…' : 'Stop session'}
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={busy}
              title="Clear this issue's run history and tracked PR so it can be dispatched again"
              onClick={() => onReset(issue.number)}
            >
              <RotateCcw size={12} />
              {busy ? 'Resetting…' : 'Reset to backlog'}
            </Button>
          </div>
        ) : null}

        {pullRequest ? (
          <section
            className={`space-y-2 rounded-lg border bg-surface-raised p-3 ${
              awaitingReview ? 'border-attention/60 ring-1 ring-attention/25' : 'border-line'
            }`}
          >
            {awaitingReview ? (
              <p className="text-xs font-medium text-attention">Awaiting review — merge it to finish this issue</p>
            ) : null}
            <a
              href={pullRequest.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-text hover:underline"
            >
              <GitPullRequest size={14} />#{pullRequest.number} {pullRequest.title}
            </a>
            <div className="flex items-center gap-2">
              <Badge tone={pullRequest.merged ? 'success' : awaitingReview ? 'attention' : 'neutral'}>
                {pullRequest.merged ? 'merged' : awaitingReview ? 'awaiting review' : pullRequest.state}
              </Badge>
              <CheckList checks={pullRequest.checks} />
            </div>
            <p className="text-[11px] text-muted">
              {pullRequest.merged
                ? 'Merged — this issue counts as done.'
                : 'The issue only moves to Merged once you merge this pull request.'}
            </p>
          </section>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Timeline</h3>
            {messageCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setShowMessages((value) => !value)}>
                {showMessages ? 'Hide session messages' : `Show session messages (${messageCount})`}
              </Button>
            ) : null}
          </div>
          {events.length === 0 ? (
            <p className="text-xs text-faint">No activity recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="rounded-md border border-line bg-surface-raised p-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={EVENT_TONES[event.kind]}>{event.phase ? PHASE_LABELS[event.phase] : event.kind}</Badge>
                    <span className="text-[10px] text-faint">{formatRelative(event.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{event.message}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Issue</h3>
          <p className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-line bg-surface-raised p-3 text-xs text-muted">
            {issue.body || 'No description.'}
          </p>
        </section>
      </div>
    </Drawer>
  );
}
