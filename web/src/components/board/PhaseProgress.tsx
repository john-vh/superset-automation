import { RUN_PHASE_ORDER, phaseRank } from '@shared/board';
import type { Phase } from '@shared/types';
import type { Tone } from '@/lib/phase';
import { cn } from '@/lib/utils';

export interface PhaseProgressProps {
  phase: Phase;
  /** Health of the card, so the bar reads the same as its status pill. */
  tone: Tone;
  /** Only a session that is genuinely running animates — movement always means Devin is working. */
  working: boolean;
}

const FILLS: Record<Tone, string> = {
  neutral: 'bg-line-strong',
  active: 'bg-active',
  attention: 'bg-attention',
  success: 'bg-success',
  danger: 'bg-danger',
};

/** Segmented bar showing how far a session has moved through its lifecycle. */
export function PhaseProgress({ phase, tone, working }: PhaseProgressProps) {
  const reached = phaseRank(phase);
  const fill = FILLS[tone];

  return (
    <div className="flex gap-1" aria-label={`Phase ${phase}`}>
      {RUN_PHASE_ORDER.map((step, index) => (
        <span
          key={step}
          className={cn(
            'h-1 flex-1 rounded-full transition-colors',
            index > reached ? 'bg-line' : fill,
            index === reached && working && 'animate-pulse',
          )}
        />
      ))}
    </div>
  );
}
