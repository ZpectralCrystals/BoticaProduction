import { useEffect, useRef } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth } from '@/context/auth-context'
import { useAuthBridge } from '@/context/auth-bridge'
import { CLERK_ENABLED } from '@/lib/clerk-provider'

function ClerkSessionCoordinatorInner({ children }: PropsWithChildren) {
  const { loading, signOut, syncClerkSession, user } = useAuth()
  const {
    clerkLoaded,
    clerkSignedIn,
    clerkUserId,
    getClerkToken,
  } = useAuthBridge()
  const attemptedUserId = useRef<string | null>(null)

  useEffect(() => {
    if (!clerkLoaded || loading) return

    if (!clerkSignedIn) {
      attemptedUserId.current = null
      if (user?.authSource === 'clerk') {
        void signOut()
      }
      return
    }

    if (user || !clerkUserId || attemptedUserId.current === clerkUserId) return
    attemptedUserId.current = clerkUserId

    void getClerkToken()
      .then((token) => {
        if (!token) throw new Error('Clerk no entregó un token de sesión')
        return syncClerkSession(token)
      })
      .catch(() => {
        // AuthContext expone el mensaje; no reintentar hasta cambiar sesión Clerk.
      })
  }, [
    clerkLoaded,
    clerkSignedIn,
    clerkUserId,
    getClerkToken,
    loading,
    signOut,
    syncClerkSession,
    user,
  ])

  return <>{children}</>
}

export function ClerkSessionCoordinator({ children }: PropsWithChildren) {
  if (!CLERK_ENABLED) return <>{children}</>
  return <ClerkSessionCoordinatorInner>{children}</ClerkSessionCoordinatorInner>
}
