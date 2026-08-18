import { createContext, useContext } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/clerk-react'
import { useAuth as useLocalAuth } from '@/context/auth-context'
import { CLERK_ENABLED } from '@/lib/clerk-provider'

// Clerk prueba identidad; la sesión ERP conserva roles/permisos de bot_usuarios.
// Login DNI permanece como acceso local de contingencia.

export type AuthMode = 'local' | 'hybrid'

/** Qué sesiones están activas actualmente (para lógica de UI) */
export type ActiveSession = 'local' | 'clerk' | 'both' | 'none'

export interface ClerkBridgeData {
  clerkLoaded: boolean
  clerkSignedIn: boolean
  clerkEmail: string | null
  clerkUserId: string | null
  clerkDisplayName: string | null
  clerkAvatarUrl: string | null
  getClerkToken: () => Promise<string | null>
  signOutClerk: () => Promise<void>
}

const defaultClerkData: ClerkBridgeData = {
  clerkLoaded: true,
  clerkSignedIn: false,
  clerkEmail: null,
  clerkUserId: null,
  clerkDisplayName: null,
  clerkAvatarUrl: null,
  getClerkToken: async () => null,
  signOutClerk: async () => {},
}

// ──────────────────────────────────────────────────────────────────────────────
// ClerkBridgeContext: expone datos de Clerk de forma segura
// Cuando Clerk no está habilitado, provee valores vacíos por defecto
// ──────────────────────────────────────────────────────────────────────────────

const ClerkBridgeContext = createContext<ClerkBridgeData>(defaultClerkData)

// Componente interno que llama hooks de Clerk.
// Solo se monta cuando ClerkProvider está activo (CLERK_ENABLED=true).
function ClerkBridgeInner({ children }: PropsWithChildren) {
  const { getToken, isLoaded, isSignedIn, signOut } = useClerkAuth()
  const { user } = useClerkUser()

  const value: ClerkBridgeData = {
    clerkLoaded: isLoaded,
    clerkSignedIn: isSignedIn ?? false,
    clerkEmail: user?.primaryEmailAddress?.emailAddress ?? null,
    clerkUserId: user?.id ?? null,
    clerkDisplayName: user?.fullName ?? user?.firstName ?? null,
    clerkAvatarUrl: user?.imageUrl ?? null,
    getClerkToken: getToken,
    signOutClerk: async () => { await signOut() },
  }

  return (
    <ClerkBridgeContext.Provider value={value}>
      {children}
    </ClerkBridgeContext.Provider>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// ClerkBridgeProvider: montar en AppProviders
// Renderiza ClerkBridgeInner solo si Clerk está habilitado,
// garantizando que los hooks de Clerk nunca se llamen fuera de ClerkProvider
// ──────────────────────────────────────────────────────────────────────────────

export function ClerkBridgeProvider({ children }: PropsWithChildren) {
  if (!CLERK_ENABLED) {
    return (
      <ClerkBridgeContext.Provider value={defaultClerkData}>
        {children}
      </ClerkBridgeContext.Provider>
    )
  }
  return <ClerkBridgeInner>{children}</ClerkBridgeInner>
}

// ──────────────────────────────────────────────────────────────────────────────
// useAuthBridge — Hook principal de la capa de coexistencia
// Expone ambas sesiones (local y Clerk) de forma clara y tipada.
// ──────────────────────────────────────────────────────────────────────────────

export function useAuthBridge() {
  const local = useLocalAuth()
  const clerk = useContext(ClerkBridgeContext)

  const hasLocal = Boolean(local.user)
  const hasClerk = clerk.clerkSignedIn

  const activeSession: ActiveSession =
    hasLocal && hasClerk ? 'both'
    : hasLocal ? 'local'
    : hasClerk ? 'clerk'
    : 'none'

  const erpLinkedByClerk = hasClerk && local.user?.authSource === 'clerk'

  return {
    // Clerk gestiona identidad; JWT ERP conserva roles y permisos internos.
    mode: (CLERK_ENABLED ? 'hybrid' : 'local') as AuthMode,

    // ── Qué sesiones están activas (para UI, indicadores) ─────────────────
    activeSession,
    isAuthenticated: hasLocal,
    erpSessionActive: hasLocal,
    erpLinkedByClerk,

    // ── Sesión local ERP (bot_usuarios / JWT) ─────────────────────────────
    isLocalAuthenticated: hasLocal,
    localUser: local.user ?? null,
    localUserName: local.user?.nombre ?? null,
    localRole: local.user?.rol ?? null,
    localPermisos: local.user?.permisos ?? [],

    // ── Sesión Clerk (identidad / email) ──────────────────────────────────
    isClerkAuthenticated: hasClerk,
    clerkSignedIn: hasClerk,
    clerkEmail: clerk.clerkEmail,
    clerkUserId: clerk.clerkUserId,
    clerkDisplayName: clerk.clerkDisplayName,
    clerkAvatarUrl: clerk.clerkAvatarUrl,
    clerkLoaded: clerk.clerkLoaded,
    getClerkToken: clerk.getClerkToken,
    signOutClerk: clerk.signOutClerk,
    signOutAll: async () => {
      try {
        await clerk.signOutClerk()
      } finally {
        await local.signOut()
      }
    },

    // ── Feature flag ──────────────────────────────────────────────────────
    clerkEnabled: CLERK_ENABLED,
  }
}
