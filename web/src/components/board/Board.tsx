import { BOARD_COLUMNS } from '@shared/board';
import type { CardDto } from '@shared/types';
import { AttentionList } from './AttentionList';
import { IssueCard } from './IssueCard';

export interface BoardProps {
  cards: CardDto[];
  dispatching: number | null;
  busy: number | null;
  canDispatch: boolean;
  onDispatch: (issueNumber: number) => void;
  onStop: (issueNumber: number) => void;
  onReset: (issueNumber: number) => void;
  onOpen: (card: CardDto) => void;
}

export function Board({ cards, dispatching, busy, canDispatch, onDispatch, onStop, onReset, onOpen }: BoardProps) {
  const attention = cards.filter((card) => card.phase === 'attention');

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <AttentionList cards={attention} busy={busy} onReset={onReset} onOpen={onOpen} />

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {BOARD_COLUMNS.map((column) => {
          const columnCards = cards.filter((card) => column.accepts.includes(card.phase));
          return (
            <section
              key={column.key}
              className="flex h-full w-72 shrink-0 flex-col rounded-lg border border-line bg-surface"
            >
              <header
                className="flex items-center justify-between border-b border-line px-3 py-2"
                title={column.description}
              >
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{column.title}</h2>
                <span className="rounded bg-surface-raised px-1.5 text-[11px] text-faint">{columnCards.length}</span>
              </header>
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
                {columnCards.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-line text-[11px] text-faint">
                    Nothing here
                  </div>
                ) : (
                  columnCards.map((card) => (
                    <IssueCard
                      key={card.issue.number}
                      card={card}
                      dispatching={dispatching === card.issue.number}
                      busy={busy === card.issue.number}
                      canDispatch={canDispatch}
                      onDispatch={onDispatch}
                      onStop={onStop}
                      onReset={onReset}
                      onOpen={onOpen}
                      inPhaseColumn
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
