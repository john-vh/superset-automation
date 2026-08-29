import type { CheckDto } from '@shared/types';
import { Badge } from '@/components/ui/badge';
import { CHECK_LABELS, CHECK_TONES } from '@/lib/phase';

export interface CheckListProps {
  checks: CheckDto[];
  limit?: number;
}

export function CheckList({ checks, limit }: CheckListProps) {
  if (checks.length === 0) return null;

  const visible = limit ? checks.slice(0, limit) : checks;
  const hidden = checks.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((check) => (
        <Badge key={check.id} tone={CHECK_TONES[check.state]} title={`${check.name}: ${check.state}`}>
          {check.name.length > 18 ? `${check.name.slice(0, 18)}…` : check.name} · {CHECK_LABELS[check.state]}
        </Badge>
      ))}
      {hidden > 0 ? <Badge>+{hidden}</Badge> : null}
    </div>
  );
}
