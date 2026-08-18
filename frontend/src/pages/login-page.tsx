import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { KeyRound } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { BrandLogo } from '@/components/shared/brand-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClerkSignInButton } from '@/components/auth/clerk/ClerkSignInButton'
import { CLERK_ENABLED } from '@/lib/clerk-provider'

export function LoginPage() {
  const navigate = useNavigate()
  const { user, loading, signIn, defaultPath } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user && !loading) {
    return <Navigate replace to={defaultPath} />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const dni = String(formData.get('dni') ?? '').trim()
    const clave = String(formData.get('clave') ?? '')

    setSubmitting(true)
    setError(null)
    try {
      await signIn(dni, clave)
      toast.success('Sesion iniciada correctamente.')
      navigate(defaultPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexion')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#018c77] via-[#02c1a1] to-[#ff8800] px-4">
      <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-white/8 blur-3xl" />
      <div className="absolute -right-10 bottom-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />

      <div className="relative w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-6 w-fit rounded-[28px] bg-white/95 p-5 shadow-[0_18px_42px_rgba(255,136,0,0.24)]">
            <BrandLogo imgClassName="h-16 w-auto" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-white">
            Botica El Pueblo
          </h1>
          <p className="mt-2 text-sm text-white/70">
            Sistema de gestion de farmacia
          </p>
        </div>

        <div className="rounded-[28px] border border-white/20 bg-white/95 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.15)] backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-primary-strong">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold">Iniciar sesion</p>
              <p className="text-sm text-muted">Ingresa tu DNI y contraseña</p>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold">DNI</span>
              <Input
                autoComplete="username"
                autoFocus
                maxLength={8}
                minLength={8}
                name="dni"
                placeholder="00000000"
                required
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Contraseña</span>
              <Input
                autoComplete="current-password"
                name="clave"
                placeholder="••••••••"
                required
                type="password"
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? 'Verificando...' : 'Ingresar'}
            </Button>
          </form>

          {CLERK_ENABLED ? (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-border" />
                <span>o</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <ClerkSignInButton redirectUrl="/auth/clerk" variant="outline">
                <button className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
                  Ingresar con correo
                </button>
              </ClerkSignInButton>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  )
}
