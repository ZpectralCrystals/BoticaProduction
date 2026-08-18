import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function LoginCard() {
  const navigate = useNavigate()
  const { signIn, user, defaultPath, roleDefinition } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const dni = String(formData.get('dni') ?? '').trim()
    const clave = String(formData.get('clave') ?? '')

    setLoading(true)
    setError(null)
    try {
      await signIn(dni, clave)
      toast.success('Sesion iniciada correctamente.')
      navigate(defaultPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexion')
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    return (
      <Card className="overflow-hidden" id="login">
        <CardHeader>
          <Badge className="w-fit" variant="success">
            Sesion activa
          </Badge>
          <CardTitle>Bienvenido, {user.nombre}</CardTitle>
          <CardDescription>
            Conectado como {roleDefinition?.label}. DNI: {user.dni}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => navigate(defaultPath)}>
            Ir al panel
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden" id="login">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary-strong">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>Iniciar sesion</CardTitle>
            <CardDescription>
              Ingresa tu DNI y contraseña para acceder al sistema.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="space-y-2">
            <span className="text-sm font-semibold">DNI</span>
            <Input
              maxLength={8}
              minLength={8}
              name="dni"
              placeholder="00000000"
              required
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Contraseña</span>
            <Input
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

          <Button className="w-full" disabled={loading} type="submit">
            {loading ? 'Verificando...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
