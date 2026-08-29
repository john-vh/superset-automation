import { PHASE_LABELS } from '@shared/board';
import type { CardDto } from '@shared/types';
import { ExternalLink, GitPullRequest, Play, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PHASE_TONES } from '@/lib/phase';
import { formatRelative } from '@/lib/utils';
import { CheckList } from './CheckList';
import { PhaseProgress } from './PhaseProgress';

export interface IssueCardProps {
  card: CardDto;
  dispatching: boolean;
  canDispatch: boolean;
  onDispatch: (issueNumber: number) => void;
  onOpen: (card: CardDto) => void;
}

export function IssueCard({ card, dispatching, canDispatch, onDispatch, onOpen }: IssueCardProps) {
  const { issue, run, pullRequest, phase } = card;

  return (
    <article
      className="group cursor-pointer rounded-lg border border-line bg-surface-raised p-3 transition-colors hover:border-line-strong"
      onClick={() => onOpen(card)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-faint">#{issue.number}</span>
        <Badge tone={PHASE_TONES[phase]}>{PHASE_LABELS[phase]}</Badge>
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
          <div className="flex items-center justify-between text-[11px] text-faint">
            <span>{run.acus > 0 ? `${run.acus.toFixed(1)} ACU` : 'session running'}</span>
            <span>{formatRelative(run.updatedAt)}</span>
          </div>
        </div>
      ) : null}

      {pullRequest ? (
        <div className="mt-3 space-y-2">
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-info hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            <GitPullRequest size={13} />PR #{pullRequest.number}
            <ExternalLink size={11} />
          </a>
          <CheckList checks={pullRequest.checks} limit={3} />
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        {run ? (
          run.sessionUrl ? (
            <a
              href={run.sessionUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text"
              onClick={(event) => event.stopPropagation()}
            >
              <Sparkles size={13} />Devin session
            </a>
          ) : null
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
