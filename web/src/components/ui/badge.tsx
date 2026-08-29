import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-raised text-muted',
        active: 'border-active/40 bg-active/15 text-active',
        success: 'border-success/40 bg-success/15 text-success',
        warning: 'border-warning/40 bg-warning/15 text-warning',
        danger: 'border-danger/40 bg-danger/15 text-danger',
        info: 'border-info/40 bg-info/15 text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
