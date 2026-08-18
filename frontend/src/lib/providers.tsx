import type { PropsWithChildren } from 'react'
import { Toaster } from 'sonner'
import { AppDataProvider } from '@/context/app-data-context'
import { AuthProvider } from '@/context/auth-context'
import { ClerkBridgeProvider } from '@/context/auth-bridge'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ClerkBridgeProvider>
      <AuthProvider>
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
      </AuthProvider>
    </ClerkBridgeProvider>
  )
}
