import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiGetProveedores, apiSaveProveedor } from '@/lib/api'
import type { ApiProveedor } from '@/lib/api'
import { Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

function normalizeRuc(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

function hasValidPhone(value: string) {
  return value.replace(/\D/g, '').length >= 6
}

function hasValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isProviderComplete(provider: Pick<ApiProveedor, 'cruc' | 'cnombre' | 'ctelefono' | 'ccontacto'>) {
  return Boolean(
    normalizeRuc((provider.cruc ?? '').trim()).length === 11 &&
    (provider.cnombre ?? '').trim() &&
    hasValidPhone((provider.ctelefono ?? '').trim()) &&
    (provider.ccontacto ?? '').trim(),
  )
}

function getProviderState(provider: Pick<ApiProveedor, 'cestado'>) {
  return provider.cestado === 'I' ? 'INACTIVO' : 'ACTIVO'
}

export function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<ApiProveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [buscar, setBuscar] = useState('')
  const [form, setForm] = useState({ nombre: '', ruc: '', contacto: '', telefono: '', email: '', direccion: '', notas: '', estado: 'ACTIVO' as 'ACTIVO' | 'INACTIVO' })

  const validationErrors = [
    !form.ruc.trim() ? 'El RUC es obligatorio' : '',
    form.ruc.trim() && form.ruc.trim().length !== 11 ? 'El RUC debe tener 11 dígitos' : '',
    !form.nombre.trim() ? 'La razón social es obligatoria' : '',
    !form.contacto.trim() ? 'La persona de contacto es obligatoria' : '',
    !form.telefono.trim() ? 'El teléfono es obligatorio' : '',
    form.telefono.trim() && !hasValidPhone(form.telefono) ? 'El teléfono debe tener al menos 6 dígitos' : '',
    form.email.trim() && !hasValidEmail(form.email.trim()) ? 'El email no es válido' : '',
  ].filter(Boolean)

  const isFormValid = validationErrors.length === 0

  const load = useCallback(() => {
    setLoading(true)
    apiGetProveedores(buscar || undefined, { includeInactive: true })
      .then(setProveedores)
      .catch(() => toast.error('Error al cargar proveedores'))
      .finally(() => setLoading(false))
  }, [buscar])

  useEffect(() => { load() }, [load])

  const startCreate = () => {
    setEditId(null)
    setForm({ nombre: '', ruc: '', contacto: '', telefono: '', email: '', direccion: '', notas: '', estado: 'ACTIVO' })
    setShowForm(true)
  }

  const startEdit = (p: ApiProveedor) => {
    setEditId(p.nid)
    setForm({
      nombre: (p.cnombre ?? '').trim(),
      ruc: (p.cruc ?? '').trim(),
      contacto: (p.ccontacto ?? '').trim(),
      telefono: (p.ctelefono ?? '').trim(),
      email: (p.cemail ?? '').trim(),
      direccion: (p.cdireccion ?? '').trim(),
      notas: (p.cnotas ?? '').trim(),
      estado: getProviderState(p),
    })
    setShowForm(true)
  }

  const submit = async () => {
    if (!isFormValid) {
      toast.error(validationErrors[0] || 'Complete los datos obligatorios del proveedor')
      return
    }
    try {
      const payload: Record<string, unknown> = { ...form }
      if (editId) payload.id = parseInt(editId)
      await apiSaveProveedor(payload)
      toast.success(editId ? 'Proveedor actualizado' : 'Proveedor creado')
      setShowForm(false)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Proveedores</p>
            <p className="text-2xl font-semibold text-foreground">{proveedores.length}</p>
            <p className="text-sm text-muted">Datos fiscales y contacto para compras.</p>
          </div>
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </Button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input className="pl-9" placeholder="Buscar por nombre o RUC..." value={buscar} onChange={e => setBuscar(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neutral">
              {proveedores.filter((provider) => provider.cestado !== 'I').length} activo(s)
            </Badge>
            <Badge variant="neutral">
              {proveedores.filter((provider) => provider.cestado === 'I').length} inactivo(s)
            </Badge>
            <Badge variant="neutral">
              {proveedores.filter((provider) => !isProviderComplete(provider)).length} incompleto(s)
            </Badge>
          </div>
        </div>
      </Card>

      <Dialog open={showForm} onClose={() => setShowForm(false)}>
        <DialogTitle>{editId ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Un proveedor válido debe tener RUC único, razón social, teléfono y persona de contacto.
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary-strong">
            La validación con SUNAT queda pendiente para una fase futura. En esta etapa solo se exige formato mínimo, unicidad y completitud operativa.
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Los proveedores inactivos se mantienen para auditoría e historial, pero no deben aparecer en compras nuevas.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Razón social *</span>
              <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Distribuidora XYZ SAC" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">RUC *</span>
              <Input value={form.ruc} onChange={e => setForm({ ...form, ruc: normalizeRuc(e.target.value) })} placeholder="20123456789" maxLength={11} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Persona de contacto *</span>
              <Input value={form.contacto} onChange={e => setForm({ ...form, contacto: e.target.value })} placeholder="Juan Perez" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Teléfono *</span>
              <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="999 999 999" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Email recomendado</span>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ventas@empresa.com" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Dirección recomendada</span>
              <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Av. Industrial 456" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Estado</span>
              <select
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value as 'ACTIVO' | 'INACTIVO' })}
              >
                <option value="ACTIVO">ACTIVO</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </label>
          </div>
          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {validationErrors.map((error) => (
                <p key={error}>- {error}</p>
              ))}
            </div>
          )}
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Notas</span>
            <textarea className="min-h-[76px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Condiciones de pago, horarios de entrega, etc." />
          </label>
          <div className="flex gap-3">
            <Button onClick={submit} disabled={!isFormValid}>{editId ? 'Guardar cambios' : 'Crear proveedor'}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      </Dialog>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">RUC</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Telefono</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Direccion</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {proveedores.map(p => (
                <tr key={p.nid} className="border-b last:border-0 hover:bg-primary/5">
                  <td className="px-4 py-3 font-semibold">
                    <div className="flex items-center gap-2">
                      <span>{(p.cnombre ?? '').trim()}</span>
                      {!isProviderComplete(p) && <Badge className="bg-amber-100 text-amber-800">Incompleto</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant="neutral">{(p.cruc ?? '').trim() || '-'}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge className={p.cestado === 'I' ? 'bg-slate-200 text-slate-800' : 'bg-emerald-100 text-emerald-800'}>
                      {getProviderState(p)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{(p.ccontacto ?? '').trim() || '-'}</td>
                  <td className="px-4 py-3">{(p.ctelefono ?? '').trim() || '-'}</td>
                  <td className="px-4 py-3 text-muted">{(p.cemail ?? '').trim() || '-'}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-muted">{(p.cdireccion ?? '').trim() || '-'}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => startEdit(p)}>Editar</Button></td>
                </tr>
              ))}
              {proveedores.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted">Sin proveedores registrados</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
