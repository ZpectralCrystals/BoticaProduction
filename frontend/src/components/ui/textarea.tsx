import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export const textareaBaseClassName =
  'min-h-28 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return <textarea ref={ref} className={cn(textareaBaseClassName, className)} {...props} />
})

Textarea.displayName = 'Textarea'
