import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0 flex-1 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
          {eyebrow}
        </p>
        <div className="space-y-2">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-base leading-7 text-muted">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  )
}
