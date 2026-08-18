import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-white shadow-sm hover:bg-primary-strong',
        secondary:
          'border-border bg-white text-foreground hover:bg-surface',
        ghost:
          'border-transparent bg-transparent text-foreground hover:bg-primary/10 hover:text-primary-strong',
        outline:
          'border-border bg-white text-foreground hover:bg-primary/10 hover:text-primary-strong',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-11 px-5 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
