import type { PropsWithChildren } from 'react'
import { ClerkProvider } from '@clerk/clerk-react'

// ══════════════════════════════════════════════════════════════════════════════
// CLERK PROVIDER WRAPPER
// ══════════════════════════════════════════════════════════════════════════════
// Renderiza ClerkProvider solo si VITE_CLERK_PUBLISHABLE_KEY está definida.
// Si no está definida (dev sin Clerk), renderiza los hijos sin wrapper.
// Esto garantiza cero crashes en entornos sin la variable.
// ══════════════════════════════════════════════════════════════════════════════

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
const CLERK_PROXY_URL = resolveClerkProxyUrl(CLERK_KEY)

export const CLERK_ENABLED = Boolean(CLERK_KEY)

export function resolveClerkProxyUrl(publishableKey: string | undefined) {
  return publishableKey?.startsWith('pk_live_') ? '/__clerk' : undefined
}

export function ClerkProviderWrapper({ children }: PropsWithChildren) {
  if (!CLERK_KEY) {
    return <>{children}</>
  }

  return (
    <ClerkProvider publishableKey={CLERK_KEY} proxyUrl={CLERK_PROXY_URL}>
      {children}
    </ClerkProvider>
  )
}
