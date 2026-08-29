import { RUN_PHASE_ORDER, phaseRank } from '@shared/board';
import type { Phase } from '@shared/types';
import { cn } from '@/lib/utils';

export interface PhaseProgressProps {
  phase: Phase;
  needsAttention: boolean;
}

/** Segmented bar showing how far a session has moved through its lifecycle. */
export function PhaseProgress({ phase, needsAttention }: PhaseProgressProps) {
  const reached = phaseRank(phase);

  return (
    <div className="flex gap-1" aria-label={`Phase ${phase}`}>
      {RUN_PHASE_ORDER.map((step, index) => (
        <span
          key={step}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors',
            index > reached && 'bg-line',
            index <= reached && (needsAttention ? 'bg-warning' : 'bg-active'),
            index === reached && !needsAttention && step !== 'done' && 'animate-pulse',
            phase === 'done' && index <= reached && 'bg-success',
          )}
        />
      ))}
    </div>
  );
}
