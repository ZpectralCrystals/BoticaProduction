import { useState } from 'react'
import type { ReactNode } from 'react'
import { CircleAlert, LoaderCircle, LockKeyhole, LogOut, RotateCcw } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BrandLogo } from '@/components/shared/brand-logo'
import { Button } from '@/components/ui/button'
import { useAuthBridge } from '@/context/auth-bridge'
import { useAuth } from '@/context/auth-context'
import { CLERK_ENABLED } from '@/lib/clerk-provider'

export type EmailAccessState =
  | 'authenticated'
  | 'denied'
  | 'disabled'
  | 'loading'
  | 'signed-out'

export function resolveEmailAccessState({
  clerkEnabled,
  clerkLoaded,
  clerkSignedIn,
  error,
  loading,
  userAuthenticated,
}: {
  clerkEnabled: boolean
  clerkLoaded: boolean
  clerkSignedIn: boolean
  error: string | null
  loading: boolean
  userAuthenticated: boolean
}): EmailAccessState {
  if (userAuthenticated) return 'authenticated'
  if (!clerkEnabled) return 'disabled'
  if (!clerkLoaded || loading) return 'loading'
  if (!clerkSignedIn) return 'signed-out'
  if (error) return 'denied'
  return 'loading'
}

export function EmailAuthCallbackPage() {
  const navigate = useNavigate()
  const { defaultPath, error, loading, user } = useAuth()
  const {
    clerkEmail,
    clerkLoaded,
    clerkSignedIn,
    signOutAll,
  } = useAuthBridge()
  const [signingOut, setSigningOut] = useState(false)

  const state = resolveEmailAccessState({
    clerkEnabled: CLERK_ENABLED,
    clerkLoaded,
    clerkSignedIn,
    error,
    loading,
    userAuthenticated: Boolean(user),
  })

  if (state === 'authenticated') {
    return <Navigate replace to={defaultPath} />
  }

  async function leaveEmailSession() {
    setSigningOut(true)
    try {
      await signOutAll()
      navigate('/', { replace: true })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7f6] px-4 py-10">
      <main className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <BrandLogo className="mx-auto mb-7 w-fit" imgClassName="h-14 w-auto" />

        {state === 'loading' ? (
          <AccessMessage
            icon={<LoaderCircle className="h-6 w-6 animate-spin" />}
            title="Verificando acceso"
            description="Validando identidad, estado y permisos del usuario."
          />
        ) : null}

        {state === 'signed-out' ? (
          <AccessMessage
            icon={<LockKeyhole className="h-6 w-6" />}
            title="Sesión no iniciada"
            description="Vuelve al ingreso con correo para identificarte."
          >
            <Button className="mt-5 w-full" onClick={() => navigate('/login/clerk')}>
              Ingresar con correo
            </Button>
          </AccessMessage>
        ) : null}

        {state === 'disabled' ? (
          <AccessMessage
            icon={<CircleAlert className="h-6 w-6" />}
            title="Acceso por correo no disponible"
            description="Usa tu DNI y contraseña para ingresar."
          >
            <Button className="mt-5 w-full" onClick={() => navigate('/')}>
              Volver al inicio
            </Button>
          </AccessMessage>
        ) : null}

        {state === 'denied' ? (
          <AccessMessage
            danger
            icon={<CircleAlert className="h-6 w-6" />}
            title="Cuenta sin acceso al sistema"
            description="Tu correo no está vinculado a un usuario activo. Contacta al administrador."
          >
            {clerkEmail ? (
              <p className="mt-3 truncate text-center text-sm font-medium text-slate-700">
                {clerkEmail}
              </p>
            ) : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Button disabled={signingOut} onClick={() => { void leaveEmailSession() }}>
                <LogOut className="h-4 w-4" />
                {signingOut ? 'Saliendo...' : 'Usar otra cuenta'}
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                <RotateCcw className="h-4 w-4" />
                Reintentar
              </Button>
            </div>
          </AccessMessage>
        ) : null}
      </main>
    </div>
  )
}

function AccessMessage({
  children,
  danger = false,
  description,
  icon,
  title,
}: {
  children?: ReactNode
  danger?: boolean
  description: string
  icon: ReactNode
  title: string
}) {
  return (
    <section className="text-center" aria-live="polite">
      <div
        className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
          danger ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
        }`}
      >
        {icon}
      </div>
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className={`mt-2 text-sm ${danger ? 'text-red-700' : 'text-slate-600'}`}>
        {description}
      </p>
      {children}
    </section>
  )
}
