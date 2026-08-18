import { SignIn } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { CLERK_ENABLED } from '@/lib/clerk-provider'
import { BrandLogo } from '@/components/shared/brand-logo'

// ══════════════════════════════════════════════════════════════════════════════
// ClerkLoginPage — /login/clerk
// ══════════════════════════════════════════════════════════════════════════════
// Ruta publica para el acceso por correo de usuarios autorizados.
// Tras el login, /auth/clerk valida el vinculo y activa la sesion ERP.
// ══════════════════════════════════════════════════════════════════════════════

export function ClerkLoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f7f6] text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <BrandLogo imgClassName="h-10 w-auto" />
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {CLERK_ENABLED ? (
          <ClerkSignInView />
        ) : (
          <ClerkNotConfiguredView />
        )}
      </main>

      <footer className="flex items-center justify-center gap-2 py-4 text-center text-xs text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" />
        Acceso protegido Botica El Pueblo
      </footer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Vista: proveedor de identidad habilitado
// ──────────────────────────────────────────────────────────────────────────────

function ClerkSignInView() {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-900">Ingreso con correo</h1>
        <p className="mt-1 text-sm text-slate-500">
          Usa el correo autorizado para tu cuenta
        </p>
      </div>

      <SignIn
        routing="virtual"
        forceRedirectUrl="/auth/clerk"
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm mx-auto',
            card: 'shadow-sm rounded-lg border border-slate-200',
            headerTitle: 'text-slate-800',
            headerSubtitle: 'text-slate-500',
            socialButtonsBlockButton:
              'border border-slate-200 hover:bg-slate-50 transition-colors',
            formButtonPrimary:
              'bg-slate-800 hover:bg-slate-700 transition-colors',
            footerActionLink: 'text-slate-600 hover:text-slate-900',
          },
        }}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Vista: Clerk no configurado
// ──────────────────────────────────────────────────────────────────────────────

function ClerkNotConfiguredView() {
  return (
    <div className="w-full max-w-sm rounded-lg border border-amber-200 bg-white p-6 text-center shadow-sm">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-800">Acceso por correo no disponible</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ingresa con tu DNI y contraseña.
        </p>
      </div>
      <div className="mt-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-md bg-slate-800 px-4 py-2.5 text-sm font-medium !text-white transition-colors hover:bg-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Ir al inicio
        </Link>
      </div>
    </div>
  )
}
