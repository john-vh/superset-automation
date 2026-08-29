import { BOARD_COLUMNS } from '@shared/board';
import type { CardDto } from '@shared/types';
import { AlertTriangle } from 'lucide-react';
import { IssueCard } from './IssueCard';

export interface BoardProps {
  cards: CardDto[];
  dispatching: number | null;
  canDispatch: boolean;
  onDispatch: (issueNumber: number) => void;
  onOpen: (card: CardDto) => void;
}

export function Board({ cards, dispatching, canDispatch, onDispatch, onOpen }: BoardProps) {
  const attention = cards.filter((card) => card.phase === 'attention');

  return (
    <div className="flex flex-col gap-4">
      {attention.length > 0 ? (
        <section className="rounded-lg border border-warning/40 bg-warning/5 p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
            <AlertTriangle size={13} />Needs attention · {attention.length}
          </h2>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {attention.map((card) => (
              <IssueCard
                key={card.issue.number}
                card={card}
                dispatching={dispatching === card.issue.number}
                canDispatch={canDispatch}
                onDispatch={onDispatch}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {BOARD_COLUMNS.map((column) => {
          const columnCards = cards.filter((card) => card.phase === column.key);
          return (
            <section key={column.key} className="flex w-72 shrink-0 flex-col rounded-lg border border-line bg-surface">
              <header className="flex items-center justify-between border-b border-line px-3 py-2" title={column.description}>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{column.title}</h2>
                <span className="rounded bg-surface-raised px-1.5 text-[11px] text-faint">{columnCards.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {columnCards.length === 0 ? (
                  <p className="px-1 py-6 text-center text-[11px] text-faint">Nothing here</p>
                ) : (
                  columnCards.map((card) => (
                    <IssueCard
                      key={card.issue.number}
                      card={card}
                      dispatching={dispatching === card.issue.number}
                      canDispatch={canDispatch}
                      onDispatch={onDispatch}
                      onOpen={onOpen}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
