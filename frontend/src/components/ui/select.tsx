import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'h-10 w-full appearance-none rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition',
          'cursor-pointer focus:border-primary/50 focus:ring-4 focus:ring-primary/10',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    )
  },
)

Select.displayName = 'Select'
