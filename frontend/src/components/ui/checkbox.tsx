import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, ...props }, ref) => (
  <input
    type="checkbox"
    ref={ref}
    className={cn(
      'h-4 w-4 rounded border border-border bg-white/80 text-primary transition',
      'cursor-pointer outline-none',
      'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1',
      'checked:border-primary checked:bg-primary',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
))

Checkbox.displayName = 'Checkbox'
