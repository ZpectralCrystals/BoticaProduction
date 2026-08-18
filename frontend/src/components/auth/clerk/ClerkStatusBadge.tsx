import { useAuthBridge } from '@/context/auth-bridge'

// ══════════════════════════════════════════════════════════════════════════════
// ClerkStatusBadge — Indicador inline del estado de Clerk
// Seguro de usar en cualquier parte del árbol (usa bridge, no hooks de Clerk directos)
// ══════════════════════════════════════════════════════════════════════════════

interface ClerkStatusBadgeProps {
  showLabel?: boolean
  className?: string
}

export function ClerkStatusBadge({ showLabel = true, className = '' }: ClerkStatusBadgeProps) {
  const { clerkEnabled, clerkSignedIn } = useAuthBridge()

  if (!clerkEnabled) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        {showLabel && 'Clerk: no configurado'}
      </span>
    )
  }

  if (clerkSignedIn) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ${className}`}
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        {showLabel && 'Clerk: activo'}
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      {showLabel && 'Clerk: no autenticado'}
    </span>
  )
}
