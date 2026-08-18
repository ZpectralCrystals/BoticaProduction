import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { KeyRound, Save, User } from 'lucide-react'
import { apiGetPerfil, apiUpdatePerfil, apiCambiarClave } from '@/lib/api'
import type { ApiPerfil } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'

export function PerfilPage() {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState<ApiPerfil | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nombre: '', telefono: '', direccion: '', email: '' })
  const [claveForm, setClaveForm] = useState({ claveActual: '', claveNueva: '', confirmar: '' })
  const [showClave, setShowClave] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    apiGetPerfil()
      .then(p => {
        setPerfil(p)
        setForm({ nombre: p.nombre, telefono: p.telefono, direccion: p.direccion, email: p.email })
      })
      .catch(() => toast.error('Error al cargar perfil'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const guardarDatos = async () => {
    setSaving(true)
    try {
      await apiUpdatePerfil(form)
      toast.success('Datos actualizados')
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const cambiarClave = async () => {
    if (claveForm.claveNueva !== claveForm.confirmar) {
      toast.error('Las claves no coinciden')
      return
    }
    if (claveForm.claveNueva.length < 6) {
      toast.error('La nueva clave debe tener al menos 6 caracteres')
      return
    }
    setSaving(true)
    try {
      await apiCambiarClave(claveForm.claveActual, claveForm.claveNueva)
      toast.success('Clave actualizada correctamente')
      setClaveForm({ claveActual: '', claveNueva: '', confirmar: '' })
      setShowClave(false)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{perfil?.nombre}</h2>
            <div className="flex gap-2 mt-1">
              <Badge variant="neutral">DNI: {perfil?.dni}</Badge>
              <Badge variant="info">{perfil?.rol}</Badge>
              {user?.super && <Badge variant="warning">Super</Badge>}
              {user?.admin && !user?.super && <Badge variant="info">Admin</Badge>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Nombre completo</span>
            <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Telefono / Celular</span>
            <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="999 999 999" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Direccion</span>
            <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Av. Principal 123, Distrito" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Email</span>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" />
          </label>
          <Button onClick={guardarDatos} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Cambiar contraseña</h3>
              <p className="text-sm text-muted">Ingresa tu clave actual y la nueva</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowClave(!showClave)}>
            {showClave ? 'Cancelar' : 'Cambiar'}
          </Button>
        </div>

        {showClave && (
          <div className="space-y-3 pt-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Clave actual</span>
              <Input type="password" value={claveForm.claveActual} onChange={e => setClaveForm({ ...claveForm, claveActual: e.target.value })} placeholder="Tu clave actual" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Nueva clave</span>
              <Input type="password" value={claveForm.claveNueva} onChange={e => setClaveForm({ ...claveForm, claveNueva: e.target.value })} placeholder="Minimo 6 caracteres" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Confirmar nueva clave</span>
              <Input type="password" value={claveForm.confirmar} onChange={e => setClaveForm({ ...claveForm, confirmar: e.target.value })} placeholder="Repetir nueva clave" />
            </label>
            {claveForm.claveNueva && claveForm.confirmar && claveForm.claveNueva !== claveForm.confirmar && (
              <p className="text-sm text-red-500">Las claves no coinciden</p>
            )}
            <Button onClick={cambiarClave} disabled={saving || !claveForm.claveActual || !claveForm.claveNueva || claveForm.claveNueva !== claveForm.confirmar}>
              <KeyRound className="h-4 w-4 mr-2" />
              {saving ? 'Guardando...' : 'Actualizar clave'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
