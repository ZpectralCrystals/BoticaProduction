import { Link } from 'react-router-dom'
import { SignedIn, SignedOut, SignInButton } from '@clerk/clerk-react'
import { CLERK_ENABLED } from '@/lib/clerk-provider'
import { useAuthBridge } from '@/context/auth-bridge'
import { useAuth } from '@/context/auth-context'
import { ClerkUserCard } from '@/components/auth/clerk/ClerkUserCard'
import { ClerkStatusBadge } from '@/components/auth/clerk/ClerkStatusBadge'

// ══════════════════════════════════════════════════════════════════════════════
// CLERK TEST PAGE — /auth/clerk
// ══════════════════════════════════════════════════════════════════════════════
// Página pública de diagnóstico y verificación de integración Clerk.
// No requiere auth local. Muestra:
//   - Estado de configuración (key, habilitado)
//   - Sesión activa (local, Clerk, ambas, ninguna)
//   - Componentes reales de Clerk si está configurado
//   - Guía de próximos pasos si no lo está
// ══════════════════════════════════════════════════════════════════════════════

const MASKED_KEY = (() => {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined
  if (!key) return null
  return `${key.substring(0, 12)}…${key.substring(key.length - 4)}`
})()

export function ClerkTestPage() {
  const bridge = useAuthBridge()

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-lg space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="mb-3 inline-flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 shadow-sm">
              <span className="text-xs font-bold text-white">BP</span>
            </div>
            <span className="text-sm font-semibold text-slate-600">Botica El Pueblo</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Estado de integración Clerk</h1>
          <p className="mt-1 text-sm text-slate-500">
            <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">/auth/clerk</code>
            {' '}— página pública de diagnóstico
          </p>
          <div className="mt-2 flex justify-center">
            <ClerkStatusBadge />
          </div>
        </div>

        {/* Diagnóstico de configuración */}
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Configuración</h2>
          <div className="space-y-2">
            <DiagRow
              label="VITE_CLERK_PUBLISHABLE_KEY"
              value={MASKED_KEY ?? 'No definida'}
              ok={Boolean(MASKED_KEY)}
              mono
            />
            <DiagRow
              label="Clerk habilitado"
              value={CLERK_ENABLED ? 'Sí' : 'No'}
              ok={CLERK_ENABLED}
            />
            <DiagRow
              label="Modo auth oficial (ERP)"
              value={bridge.mode}
              ok
            />
          </div>
        </section>

        {/* Sesiones activas */}
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">Sesiones activas</h2>
          <div className="space-y-2">
            <DiagRow
              label="Sesión ERP local (JWT)"
              value={bridge.localUserName
                ? `${bridge.localUserName} (${bridge.localRole ?? '—'})`
                : 'Sin sesión'}
              ok={bridge.isLocalAuthenticated}
            />
            <DiagRow
              label="Sesión Clerk"
              value={bridge.clerkSignedIn
                ? (bridge.clerkDisplayName ?? bridge.clerkEmail ?? 'Activa')
                : 'Sin sesión'}
              ok={bridge.isClerkAuthenticated}
            />
            <DiagRow
              label="Estado combinado"
              value={
                bridge.activeSession === 'both' ? 'Ambas sesiones activas' :
                bridge.activeSession === 'local' ? 'Solo sesión ERP' :
                bridge.activeSession === 'clerk' ? 'Solo sesión Clerk' :
                'Ninguna sesión'
              }
              ok={bridge.activeSession !== 'none'}
            />
          </div>

          {bridge.erpLinkedByClerk && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 mt-1">
              <span className="font-semibold">Sesión vinculada:</span> Clerk verificó identidad y ERP cargó
              rol y permisos desde <code>bot_usuarios</code>.
            </div>
          )}
        </section>

        {/* Sección de sesión Clerk */}
        <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Sesión Clerk</h2>

          {!CLERK_ENABLED ? (
            <ClerkSetupInstructions />
          ) : (
            <>
              <SignedOut>
                <p className="text-sm text-slate-500">No hay sesión Clerk activa.</p>
                <SignInButton mode="modal">
                  <button className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700">
                    Iniciar sesión con Clerk
                  </button>
                </SignInButton>
                <p className="text-center text-xs text-slate-400">
                  O usa la{' '}
                  <Link to="/login/clerk" className="underline hover:text-slate-600">
                    página de login Clerk
                  </Link>
                </p>
              </SignedOut>

              <SignedIn>
                <ClerkErpSyncPanel />
                <ClerkUserCard showSignOut />
              </SignedIn>
            </>
          )}
        </section>

        {/* Nota arquitectónica */}
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-800 space-y-1.5">
          <p className="font-semibold text-sm">Arquitectura activa</p>
          <p>
            <code className="rounded bg-blue-100 px-1">bot_usuarios</code> es la fuente de verdad para
            roles, permisos y acceso al ERP. Clerk gestiona identidad y sesión.
          </p>
          <p>
            Sincronización <code className="rounded bg-blue-100 px-1">Clerk.id ↔ bot_usuarios</code> automática
            al iniciar sesión. Desvincular revoca acceso ERP emitido por Clerk.
          </p>
          <div className="flex gap-2 pt-1 flex-wrap">
            <Link
              to="/login/clerk"
              className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-200 transition-colors"
            >
              → Ir a /login/clerk
            </Link>
            <Link
              to="/"
              className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-200 transition-colors"
            >
              → Login ERP
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}

function ClerkErpSyncPanel() {
  const bridge = useAuthBridge()
  const { error, loading } = useAuth()

  if (bridge.erpLinkedByClerk) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
        Usuario Clerk vinculado. Sesión ERP activa como{' '}
        <span className="font-semibold">{bridge.localUserName}</span>.
        <Link className="ml-2 font-semibold underline" to="/panel">Ingresar al panel</Link>
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
      <p className="font-semibold">
        {loading ? 'Validando vínculo con ERP...' : 'Usuario Clerk sin acceso ERP activo.'}
      </p>
      <p>
        El sistema valida automáticamente
        {' '}<code className="rounded bg-amber-100 px-1">bot_usuarios.cclerk_user_id</code>.
      </p>
      <p>
        El vínculo Clerk ↔ ERP se administra desde
        {' '}<code className="rounded bg-amber-100 px-1">/panel/usuarios</code>{' '}
        por un administrador del ERP.
      </p>
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Subcomponentes
// ──────────────────────────────────────────────────────────────────────────────

function ClerkSetupInstructions() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-amber-700 font-medium">Clerk no está configurado.</p>
      <p className="text-slate-500">
        Agrega en <code className="rounded bg-slate-100 px-1">frontend/.env</code>:
      </p>
      <pre className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700 overflow-x-auto">
        VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
      </pre>
      <p className="text-xs text-slate-400">
        Obtén tu clave en{' '}
        <a
          href="https://dashboard.clerk.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-slate-600"
        >
          dashboard.clerk.com
        </a>
      </p>
    </div>
  )
}

function DiagRow({
  label,
  value,
  ok,
  mono = false,
}: {
  label: string
  value: string
  ok: boolean
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span
        className={`text-xs font-medium truncate text-right ${mono ? 'font-mono' : ''} ${
          ok ? 'text-emerald-600' : 'text-amber-600'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
