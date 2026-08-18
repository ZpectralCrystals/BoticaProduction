import { SignOutButton, UserButton } from '@clerk/clerk-react'
import { useAuthBridge } from '@/context/auth-bridge'
import { CLERK_ENABLED } from '@/lib/clerk-provider'

// ══════════════════════════════════════════════════════════════════════════════
// ClerkUserCard — Tarjeta de usuario Clerk con avatar, nombre, email y sign-out
// Usa datos del bridge (seguro fuera de ClerkProvider directo)
// Solo renderiza si hay sesión Clerk activa
// ══════════════════════════════════════════════════════════════════════════════

interface ClerkUserCardProps {
  showSignOut?: boolean
  compact?: boolean
}

export function ClerkUserCard({ showSignOut = true, compact = false }: ClerkUserCardProps) {
  const { clerkSignedIn, clerkEmail, clerkDisplayName, clerkUserId, clerkAvatarUrl } = useAuthBridge()

  if (!clerkSignedIn) return null

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {CLERK_ENABLED && <UserButton />}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-800">
            {clerkDisplayName ?? clerkEmail ?? 'Usuario Clerk'}
          </p>
          <p className="truncate text-xs text-slate-500">{clerkEmail}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        {clerkAvatarUrl ? (
          <img
            src={clerkAvatarUrl}
            alt="Avatar Clerk"
            className="h-11 w-11 rounded-full object-cover ring-2 ring-white shadow-sm"
          />
        ) : (
          CLERK_ENABLED && (
            <div className="h-11 w-11 flex-shrink-0">
              <UserButton />
            </div>
          )
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">
            {clerkDisplayName ?? 'Usuario Clerk'}
          </p>
          <p className="truncate text-xs text-slate-500">{clerkEmail ?? '—'}</p>
          {clerkUserId && (
            <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
              ID: {clerkUserId.substring(0, 22)}…
            </p>
          )}
        </div>
      </div>

      {showSignOut && CLERK_ENABLED && (
        <SignOutButton>
          <button className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
            Cerrar sesión Clerk
          </button>
        </SignOutButton>
      )}
    </div>
  )
}
