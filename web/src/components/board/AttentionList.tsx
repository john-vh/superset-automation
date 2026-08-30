import type { CardDto } from '@shared/types';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { attentionSummary } from '@/lib/phase';
import { cn } from '@/lib/utils';

export interface AttentionListProps {
  cards: CardDto[];
  busy: number | null;
  onReset: (issueNumber: number) => void;
  onOpen: (card: CardDto) => void;
}

const COLLAPSED_KEY = 'board.attention.collapsed';

/**
 * One line per stuck issue, worst first. Full cards here duplicated the board and pushed it off
 * screen as soon as two issues went wrong.
 */
export function AttentionList({ cards, busy, onReset, onOpen }: AttentionListProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === 'true');

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  if (cards.length === 0) return null;

  const rows = cards
    .map((card) => ({ card, summary: attentionSummary(card) }))
    .sort((a, b) => a.summary.rank - b.summary.rank || a.card.issue.number - b.card.issue.number);

  return (
    <section className="rounded-lg border border-line bg-surface">
      <header className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-attention"
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          <AlertTriangle size={13} />
          Needs you · {rows.length}
        </button>
      </header>

      {collapsed ? null : (
        <ul className="max-h-44 overflow-y-auto px-2 pb-2">
          {rows.map(({ card, summary }) => (
            <li key={card.issue.number}>
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md border-l-2 bg-surface-raised px-3 py-2 transition-colors hover:bg-line/40',
                  summary.rank <= 2 ? 'border-l-danger' : 'border-l-attention',
                  'mb-1',
                )}
                onClick={() => onOpen(card)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onOpen(card);
                }}
              >
                <span className="font-mono text-[11px] text-faint">#{card.issue.number}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-text">{card.issue.title}</span>
                <span className="hidden min-w-0 max-w-[45%] truncate text-[11px] text-muted sm:block">
                  {summary.reason}
                </span>
                {summary.action === 'view-pr' && card.pullRequest ? (
                  <a
                    href={card.pullRequest.url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] text-attention hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Open PR
                  </a>
                ) : summary.action === 'reply' && card.run?.sessionUrl ? (
                  <a
                    href={card.run.sessionUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-[11px] text-attention hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Reply to Devin
                  </a>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy === card.issue.number}
                    className="shrink-0"
                    onClick={(event) => {
                      event.stopPropagation();
                      onReset(card.issue.number);
                    }}
                  >
                    {busy === card.issue.number ? 'Resetting…' : 'Reset'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
