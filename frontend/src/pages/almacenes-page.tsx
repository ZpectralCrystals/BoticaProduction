import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiGetLocales, apiGetAlmacenes, apiSaveAlmacen } from '@/lib/api'
import type { ApiLocal, ApiAlmacen } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogTitle } from '@/components/ui/dialog'
import { Input, inputBaseClassName } from '@/components/ui/input'

const TIPOS_ALMACEN = [
  'DISPONIBLE', 'CUARENTENA', 'DEVOLUCION_CLIENTE', 'DEVOLUCION_PROVEEDOR',
  'BAJA', 'PROCEDIMIENTOS', 'CONTROL_ESPECIAL',
] as const

const TIPO_LABELS: Record<string, string> = {
  DISPONIBLE: 'Disponible',
  CUARENTENA: 'Cuarentena',
  DEVOLUCION_CLIENTE: 'Devolución Cliente',
  DEVOLUCION_PROVEEDOR: 'Devolución Proveedor',
  BAJA: 'Baja / Vencidos',
  PROCEDIMIENTOS: 'Procedimientos',
  CONTROL_ESPECIAL: 'Control Especial',
}

const emptyForm = {
  localId: '', nombre: '', codigo: '', tipoAlmacen: 'DISPONIBLE',
  permiteVenta: false, permiteConsumoClinico: false, requiereRevision: false,
}

export function AlmacenesPage() {
  const [items, setItems] = useState<ApiAlmacen[]>([])
  const [locales, setLocales] = useState<ApiLocal[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLocal, setFilterLocal] = useState('')
  const [showDialog, setShowDialog] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const localId = filterLocal ? Number(filterLocal) : undefined
    Promise.all([apiGetAlmacenes(localId), apiGetLocales()])
      .then(([a, l]) => { setItems(a); setLocales(l) })
      .catch(() => toast.error('Error al cargar almacenes'))
      .finally(() => setLoading(false))
  }, [filterLocal])

  useEffect(() => { load() }, [load])

  const openNew = () => { setEditId(null); setForm(emptyForm); setShowDialog(true) }
  const startEdit = (a: ApiAlmacen) => {
    setEditId(a.id)
    setForm({
      localId: String(a.localId), nombre: a.nombre, codigo: a.codigo, tipoAlmacen: a.tipoAlmacen,
      permiteVenta: a.permiteVenta, permiteConsumoClinico: a.permiteConsumoClinico, requiereRevision: a.requiereRevision,
    })
    setShowDialog(true)
  }

  const submit = async () => {
    if (!form.nombre.trim()) { toast.error('Nombre es obligatorio'); return }
    if (!form.codigo.trim()) { toast.error('Código es obligatorio'); return }
    if (!form.localId) { toast.error('Local es obligatorio'); return }
    setSaving(true)
    try {
      await apiSaveAlmacen({
        ...(editId ? { id: editId } : {}),
        localId: Number(form.localId),
        nombre: form.nombre, codigo: form.codigo, tipoAlmacen: form.tipoAlmacen,
        permiteVenta: form.permiteVenta, permiteConsumoClinico: form.permiteConsumoClinico,
        requiereRevision: form.requiereRevision,
      })
      toast.success(editId ? 'Almacén actualizado' : 'Almacén creado')
      setShowDialog(false); load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="p-6 text-muted">Cargando almacenes...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Almacenes</h2>
          <p className="text-sm text-muted">{items.length} almacén(es)</p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="rounded-lg border px-3 py-2 text-sm" value={filterLocal} onChange={e => setFilterLocal(e.target.value)}>
            <option value="">Todos los locales</option>
            {locales.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
          <Button onClick={openNew}>Nuevo almacén</Button>
        </div>
      </div>

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} className="max-w-lg">
        <DialogTitle>{editId ? 'Editar almacén' : 'Nuevo almacén'}</DialogTitle>
        <div className="space-y-3 mt-4">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Local *</span>
            <select className={inputBaseClassName} value={form.localId} onChange={e => setForm({ ...form, localId: e.target.value })}>
              <option value="">Seleccionar local...</option>
              {locales.map(l => <option key={l.id} value={l.id}>{l.nombre} ({l.tipoLocal})</option>)}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Nombre *</span>
            <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Botica – Disponible" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Código *</span>
            <Input value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} placeholder="ALM-BOT-DISP" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Tipo de almacén *</span>
            <select className={inputBaseClassName} value={form.tipoAlmacen} onChange={e => setForm({ ...form, tipoAlmacen: e.target.value })}>
              {TIPOS_ALMACEN.map(t => <option key={t} value={t}>{TIPO_LABELS[t] || t}</option>)}
            </select>
          </label>

          <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
            <p className="text-sm font-semibold">Políticas</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.permiteVenta} onChange={e => setForm({ ...form, permiteVenta: e.target.checked })} />
              Permite venta
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.permiteConsumoClinico} onChange={e => setForm({ ...form, permiteConsumoClinico: e.target.checked })} />
              Permite consumo clínico
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requiereRevision} onChange={e => setForm({ ...form, requiereRevision: e.target.checked })} />
              Requiere revisión
            </label>
          </div>

          <Button className="w-full" onClick={submit} disabled={saving}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear almacén'}
          </Button>
        </div>
      </Dialog>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted">
                <th className="pb-2">Código</th>
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Local</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Políticas</th>
                <th className="pb-2">Lotes</th>
                <th className="pb-2">Stock</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{a.codigo}</td>
                  <td className="py-2 font-semibold">{a.nombre}</td>
                  <td className="py-2 text-xs">
                    <Badge variant={a.localTipo === 'BOTICA' ? 'success' : a.localTipo === 'CLINICA' ? 'warning' : 'neutral'}>
                      {a.localNombre}
                    </Badge>
                  </td>
                  <td className="py-2 text-xs">{TIPO_LABELS[a.tipoAlmacen] || a.tipoAlmacen}</td>
                  <td className="py-2">
                    <div className="flex gap-1 flex-wrap">
                      {a.permiteVenta && <Badge variant="success">Venta</Badge>}
                      {a.permiteConsumoClinico && <Badge variant="warning">Clínico</Badge>}
                      {a.requiereRevision && <Badge variant="danger">Revisión</Badge>}
                      {!a.permiteVenta && !a.permiteConsumoClinico && !a.requiereRevision && <Badge variant="neutral">—</Badge>}
                    </div>
                  </td>
                  <td className="py-2 text-center">{a.lotesActivos}</td>
                  <td className="py-2 font-semibold">{a.stockTotal}</td>
                  <td className="py-2"><Button size="sm" variant="outline" onClick={() => startEdit(a)}>Editar</Button></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={8} className="py-4 text-center text-muted">Sin almacenes</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
