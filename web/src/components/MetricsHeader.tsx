import type { MetricsDto } from '@shared/types';
import { formatDuration, formatPercent, formatUsd } from '@/lib/utils';

const ACU_HELP =
  'Agent Compute Units — Devin bills session compute in ACUs (roughly 15 minutes of active work each), not raw tokens.';

export interface MetricsHeaderProps {
  metrics: MetricsDto;
}

interface Metric {
  label: string;
  value: string;
  tone?: 'active' | 'success' | 'danger';
  hint?: string;
}

export function MetricsHeader({ metrics }: MetricsHeaderProps) {
  const items: Metric[] = [
    { label: 'Open issues', value: String(metrics.issuesOpen) },
    { label: 'Sessions running', value: String(metrics.runsActive), tone: metrics.runsActive > 0 ? 'active' : undefined },
    { label: 'PRs open', value: String(metrics.prsOpen) },
    { label: 'PRs merged', value: String(metrics.prsMerged), tone: metrics.prsMerged > 0 ? 'success' : undefined },
    {
      label: 'Checks failing',
      value: String(metrics.checksFailing),
      tone: metrics.checksFailing > 0 ? 'danger' : undefined,
    },
    { label: 'Session success', value: formatPercent(metrics.successRate) },
    { label: 'Median time to PR', value: formatDuration(metrics.medianTimeToPrMs) },
    { label: 'ACUs used', value: metrics.acusConsumed.toFixed(2), hint: ACU_HELP },
    {
      label: 'Estimated spend',
      value: formatUsd(metrics.estimatedCostUsd),
      hint:
        metrics.acuRateUsd === null
          ? 'Set ACU_RATE_USD in .env to estimate spend.'
          : `${ACU_HELP} Estimated at $${metrics.acuRateUsd}/ACU (ACU_RATE_USD).`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-line bg-surface px-3 py-2" title={item.hint}>
          <p className="text-[11px] uppercase tracking-wide text-faint">{item.label}</p>
          <p
            className={
              item.tone === 'active'
                ? 'text-lg font-semibold text-active'
                : item.tone === 'success'
                  ? 'text-lg font-semibold text-success'
                  : item.tone === 'danger'
                    ? 'text-lg font-semibold text-danger'
                    : 'text-lg font-semibold text-text'
            }
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
