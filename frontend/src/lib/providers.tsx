import type { PropsWithChildren } from 'react'
import { Toaster } from 'sonner'
import { AppDataProvider } from '@/context/app-data-context'
import { AuthProvider } from '@/context/auth-context'
import { ClerkBridgeProvider } from '@/context/auth-bridge'
import { ClerkSessionCoordinator } from '@/context/clerk-session-coordinator'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ClerkBridgeProvider>
      <AuthProvider>
        <ClerkSessionCoordinator>
          <AppDataProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              toastOptions={{
                style: {
                  borderRadius: '18px',
                },
              }}
            />
          </AppDataProvider>
        </ClerkSessionCoordinator>
      </AuthProvider>
    </ClerkBridgeProvider>
  )
}
