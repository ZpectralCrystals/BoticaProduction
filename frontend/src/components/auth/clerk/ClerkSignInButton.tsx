import type { ReactNode } from 'react'
import { SignInButton } from '@clerk/clerk-react'
import { CLERK_ENABLED } from '@/lib/clerk-provider'

// ══════════════════════════════════════════════════════════════════════════════
// ClerkSignInButton — Botón de inicio de sesión con Clerk
// Renderiza null si Clerk no está configurado (no rompe UI sin key)
// ══════════════════════════════════════════════════════════════════════════════

interface ClerkSignInButtonProps {
  mode?: 'modal' | 'redirect'
  redirectUrl?: string
  children?: ReactNode
  className?: string
  variant?: 'primary' | 'outline' | 'ghost'
}

const variantClasses: Record<string, string> = {
  primary:
    'w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 active:bg-slate-900',
  outline:
    'w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50',
  ghost:
    'rounded px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100',
}

export function ClerkSignInButton({
  mode = 'modal',
  redirectUrl,
  children,
  className,
  variant = 'primary',
}: ClerkSignInButtonProps) {
  if (!CLERK_ENABLED) return null

  const buttonClass = className ?? variantClasses[variant]

  return (
    <SignInButton mode={mode} forceRedirectUrl={redirectUrl}>
      {children ?? (
        <button className={buttonClass}>Ingresar con correo</button>
      )}
    </SignInButton>
  )
}
