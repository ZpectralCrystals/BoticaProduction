import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const toneStyles = {
  primary: 'bg-primary/10 text-primary-strong',
  accent: 'bg-accent/15 text-primary-strong',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
}

interface MetricCardProps {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  tone?: keyof typeof toneStyles
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'primary',
}: MetricCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="font-display text-3xl font-semibold text-foreground">
            {value}
          </p>
          <p className="text-sm leading-6 text-muted">{detail}</p>
        </div>
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
            toneStyles[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}
