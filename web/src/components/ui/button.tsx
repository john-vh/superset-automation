import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-active/60',
  {
    variants: {
      variant: {
        primary: 'bg-active text-white hover:bg-active/85',
        secondary: 'border border-line bg-surface-raised text-text hover:border-line-strong hover:bg-line/40',
        ghost: 'text-muted hover:bg-surface-raised hover:text-text',
      },
      size: {
        sm: 'h-7 px-2.5',
        md: 'h-9 px-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
