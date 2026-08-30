import { PHASE_LABELS, RUN_STATUS_LABELS, isRunActive } from '@shared/board';
import type { CardDto } from '@shared/types';
import { ExternalLink, GitPullRequest, Play, RotateCcw, Sparkles, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PHASE_TONES, RUN_STATUS_TONES } from '@/lib/phase';
import { cn, formatRelative } from '@/lib/utils';
import { CheckList } from './CheckList';
import { PhaseProgress } from './PhaseProgress';

export interface IssueCardProps {
  card: CardDto;
  dispatching: boolean;
  busy: boolean;
  canDispatch: boolean;
  onDispatch: (issueNumber: number) => void;
  onStop: (issueNumber: number) => void;
  onReset: (issueNumber: number) => void;
  onOpen: (card: CardDto) => void;
}

export function IssueCard({
  card,
  dispatching,
  busy,
  canDispatch,
  onDispatch,
  onStop,
  onReset,
  onOpen,
}: IssueCardProps) {
  const { issue, run, pullRequest, phase } = card;
  const active = run ? isRunActive(run.status) : false;
  const awaitingReview = phase === 'review' && pullRequest?.state === 'open' && !pullRequest.merged;
  /** The last moment something actually happened, rather than the last poll. */
  const lastActivityAt = run ? (run.finishedAt ?? run.updatedAt) : issue.updatedAt;

  return (
    <article
      className={cn(
        'group cursor-pointer rounded-lg border bg-surface-raised p-3 transition-colors',
        awaitingReview
          ? 'border-info/60 ring-1 ring-info/30 hover:border-info'
          : run && !active && run.status !== 'finished'
            ? 'border-danger/50 hover:border-danger'
            : 'border-line hover:border-line-strong',
      )}
      onClick={() => onOpen(card)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-faint">#{issue.number}</span>
        <Badge tone={awaitingReview ? 'info' : PHASE_TONES[phase]}>
          {awaitingReview ? 'Your review needed' : PHASE_LABELS[phase]}
        </Badge>
      </div>

      <h3 className="mt-1.5 line-clamp-2 text-sm font-medium text-text">{issue.title}</h3>

      {issue.labels.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {issue.labels.slice(0, 3).map((label) => (
            <span key={label} className="rounded border border-line px-1.5 py-px text-[10px] text-muted">
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {run ? (
        <div className="mt-3 space-y-2">
          <PhaseProgress phase={phase} needsAttention={card.needsAttention} />
          <div className="flex items-center justify-between gap-2 text-[11px] text-faint">
            <span className="flex items-center gap-1.5">
              <Badge tone={RUN_STATUS_TONES[run.status]}>{RUN_STATUS_LABELS[run.status]}</Badge>
              {run.acus > 0 ? `${run.acus.toFixed(1)} ACU` : null}
            </span>
            <span>{formatRelative(lastActivityAt)}</span>
          </div>
        </div>
      ) : null}

      {pullRequest ? (
        <div className="mt-3 space-y-2">
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'inline-flex items-center gap-1.5 text-xs hover:underline',
              awaitingReview ? 'font-medium text-info' : 'text-muted',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            <GitPullRequest size={13} />
            {awaitingReview ? `Review & merge PR #${pullRequest.number}` : `PR #${pullRequest.number}`}
            <ExternalLink size={11} />
          </a>
          <CheckList checks={pullRequest.checks} limit={3} />
          {awaitingReview ? (
            <p className="text-[10px] text-muted">Merging the PR is what moves this issue to Merged.</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {run ? (
          <>
            {run.sessionUrl ? (
              <a
                href={run.sessionUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text"
                onClick={(event) => event.stopPropagation()}
              >
                <Sparkles size={13} />Devin session
              </a>
            ) : null}
            {active ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                className="text-danger hover:text-danger"
                onClick={(event) => {
                  event.stopPropagation();
                  onStop(issue.number);
                }}
              >
                <Square size={12} />
                {busy ? 'Stopping…' : 'Stop'}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                title="Clear session history and return the issue to the backlog"
                onClick={(event) => {
                  event.stopPropagation();
                  onReset(issue.number);
                }}
              >
                <RotateCcw size={12} />
                {busy ? 'Resetting…' : 'Reset'}
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={dispatching || !canDispatch}
            title={canDispatch ? undefined : 'Set DEVIN_API_KEY and DEVIN_ORG_ID to dispatch'}
            onClick={(event) => {
              event.stopPropagation();
              onDispatch(issue.number);
            }}
          >
            <Play size={12} />
            {dispatching ? 'Starting…' : 'Send to Devin'}
          </Button>
        )}
      </div>
    </article>
  );
}
