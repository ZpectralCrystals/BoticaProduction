import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-white/75 text-foreground',
        info: 'border-primary/15 bg-primary/10 text-primary-strong',
        success: 'border-success/15 bg-success/10 text-success',
        warning: 'border-warning/15 bg-warning/10 text-warning',
        danger: 'border-danger/15 bg-danger/10 text-danger',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ className, variant }))} {...props} />
}
