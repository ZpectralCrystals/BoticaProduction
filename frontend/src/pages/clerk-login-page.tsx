import { SignIn } from '@clerk/clerk-react'
import { Link } from 'react-router-dom'
import { CLERK_ENABLED } from '@/lib/clerk-provider'

// ══════════════════════════════════════════════════════════════════════════════
// ClerkLoginPage — /login/clerk
// ══════════════════════════════════════════════════════════════════════════════
// Ruta pública. Permite iniciar sesión con Clerk (email, social, etc.)
// Si Clerk no está configurado: muestra instrucciones de setup.
// Tras el login, /auth/clerk valida el vínculo y activa la sesión ERP.
// ══════════════════════════════════════════════════════════════════════════════

export function ClerkLoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
            <span className="text-xs font-bold text-white">BP</span>
          </div>
          <span className="text-sm font-semibold text-slate-700">Botica El Pueblo</span>
        </div>
        <Link
          to="/"
          className="text-xs text-slate-500 transition-colors hover:text-slate-800"
        >
          ← Volver al ERP
        </Link>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {CLERK_ENABLED ? (
          <ClerkSignInView />
        ) : (
          <ClerkNotConfiguredView />
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400">
        Identidad Clerk · permisos ERP Botica El Pueblo
      </footer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Vista: Clerk habilitado — muestra componente <SignIn> real
// ──────────────────────────────────────────────────────────────────────────────

function ClerkSignInView() {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-800">Iniciar sesión con Clerk</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tu identidad se vinculará automáticamente con tu usuario ERP
        </p>
      </div>

      {/* Clerk pre-built SignIn component */}
      <SignIn
        routing="virtual"
        forceRedirectUrl="/auth/clerk"
        signUpUrl="/login/clerk"
        appearance={{
          elements: {
            rootBox: 'w-full max-w-sm mx-auto',
            card: 'shadow-lg rounded-xl border border-slate-200',
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

      <p className="max-w-sm text-center text-xs text-slate-400">
        Tras iniciar sesión, validaremos tu acceso ERP en{' '}
        <Link to="/auth/clerk" className="underline hover:text-slate-600">
          /auth/clerk
        </Link>
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Vista: Clerk no configurado
// ──────────────────────────────────────────────────────────────────────────────

function ClerkNotConfiguredView() {
  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-800">Clerk no está configurado</h1>
        <p className="mt-1 text-sm text-slate-500">
          Para habilitar el login con Clerk, configura la variable de entorno.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-3">
        <p className="text-sm font-semibold text-amber-800">Pasos para activar Clerk</p>
        <ol className="space-y-2 text-sm text-amber-700 list-decimal list-inside">
          <li>
            Crea un proyecto en{' '}
            <a
              href="https://dashboard.clerk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-medium"
            >
              dashboard.clerk.com
            </a>
          </li>
          <li>
            Copia tu <span className="font-medium">Publishable Key</span>
          </li>
          <li>
            Agrégala en <code className="rounded bg-amber-100 px-1">frontend/.env</code>:
          </li>
        </ol>
        <pre className="rounded-lg bg-amber-100 p-3 text-xs text-amber-800 overflow-x-auto">
          VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
        </pre>
        <p className="text-xs text-amber-600">
          Reinicia el servidor de desarrollo tras agregar la variable.
        </p>
      </div>

      <div className="text-center">
        <Link
          to="/"
          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          Ir al login del ERP
        </Link>
      </div>
    </div>
  )
}
