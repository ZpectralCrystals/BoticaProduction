import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const inputBaseClassName =
  'h-10 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={cn(inputBaseClassName, className)} {...props} />
  },
)

Input.displayName = 'Input'
