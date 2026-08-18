import { createContext, useContext } from 'react'
import type { PropsWithChildren } from 'react'
import { useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/clerk-react'
import { useAuth as useLocalAuth } from '@/context/auth-context'
import { CLERK_ENABLED } from '@/lib/clerk-provider'

// ══════════════════════════════════════════════════════════════════════════════
// AUTH BRIDGE — Capa de coexistencia local JWT + Clerk
// ══════════════════════════════════════════════════════════════════════════════
//
// ARQUITECTURA DE AUTENTICACIÓN:
//
//   FASE ACTUAL (en uso):
//   ┌─────────────────────────────────────┐
//   │  Auth local (JWT)                   │
//   │  - login con DNI + clave            │
//   │  - cookie botica_token              │
//   │  - bot_usuarios como fuente única   │
//   └─────────────────────────────────────┘
//
//   FASE SIGUIENTE (en preparación):
//   ┌─────────────────────────────────────┐
//   │  Clerk (auth layer)                 │
//   │  - login social / email             │
//   │  - JWT de Clerk verificado en back  │
//   │  - sync Clerk.id ↔ bot_usuarios     │
//   └─────────────────────────────────────┘
//
//   INVARIANTE PERMANENTE:
//   bot_usuarios sigue siendo la fuente de verdad para:
//   - roles ERP (super, admin, vendedor...)
//   - permisos por módulo
//   - DNI y datos internos de empleado
//   Clerk solo gestiona identidad/sesión, nunca lógica de negocio ERP.
//
//   PUNTO DE SINCRONIZACIÓN FUTURA (Fase 3):
//   Al completar la migración, el backend deberá:
//   1. Verificar el JWT de Clerk en cada request
//   2. Buscar en bot_usuarios por clerk_user_id (campo pendiente de agregar)
//   3. Devolver roles y permisos desde bot_usuarios
//   4. Permitir login solo si existe la relación Clerk.id ↔ bot_usuarios.nid
//
// ══════════════════════════════════════════════════════════════════════════════

export type AuthMode = 'local' | 'clerk'

/** Qué sesiones están activas actualmente (para lógica de UI) */
export type ActiveSession = 'local' | 'clerk' | 'both' | 'none'

export interface ClerkBridgeData {
  clerkSignedIn: boolean
  clerkEmail: string | null
  clerkUserId: string | null
  clerkDisplayName: string | null
  clerkAvatarUrl: string | null
}

const defaultClerkData: ClerkBridgeData = {
  clerkSignedIn: false,
  clerkEmail: null,
  clerkUserId: null,
  clerkDisplayName: null,
  clerkAvatarUrl: null,
}

// ──────────────────────────────────────────────────────────────────────────────
// ClerkBridgeContext: expone datos de Clerk de forma segura
// Cuando Clerk no está habilitado, provee valores vacíos por defecto
// ──────────────────────────────────────────────────────────────────────────────

const ClerkBridgeContext = createContext<ClerkBridgeData>(defaultClerkData)

// Componente interno que llama hooks de Clerk.
// Solo se monta cuando ClerkProvider está activo (CLERK_ENABLED=true).
function ClerkBridgeInner({ children }: PropsWithChildren) {
  const { isSignedIn } = useClerkAuth()
  const { user } = useClerkUser()

  const value: ClerkBridgeData = {
    clerkSignedIn: isSignedIn ?? false,
    clerkEmail: user?.primaryEmailAddress?.emailAddress ?? null,
    clerkUserId: user?.id ?? null,
    clerkDisplayName: user?.fullName ?? user?.firstName ?? null,
    clerkAvatarUrl: user?.imageUrl ?? null,
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

  const erpLinkedByClerk = hasClerk && hasLocal

  return {
    // ── Modo oficial de auth para el ERP ─────────────────────────────────
    // 'local' hasta que se complete la migración Fase 3.
    // Cambiar a 'clerk' solo cuando backend verifique JWT de Clerk.
    mode: 'local' as AuthMode,

    // ── Qué sesiones están activas (para UI, indicadores) ─────────────────
    activeSession,
    isAuthenticated: hasLocal || hasClerk,
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

    // ── Feature flag ──────────────────────────────────────────────────────
    clerkEnabled: CLERK_ENABLED,
  }
}
