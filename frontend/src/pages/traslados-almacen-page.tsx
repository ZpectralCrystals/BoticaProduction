import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowRightLeft, RefreshCw } from 'lucide-react'
import {
  apiGetInventory, apiGetAlmacenes, apiPostTrasladoAlmacen, apiGetTrasladosAlmacen, apiGetLotesDisponibles,
} from '@/lib/api'
import type { ApiInventoryItem, ApiAlmacen, ApiLoteFefo } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type TrasladoHistorialItem = {
  id: number
  productoCodigo: string
  productoNombre: string
  cantidad: number
  almacenOrigen?: { nombre: string } | null
  almacenDestino?: { nombre: string } | null
  detalle?: string | null
  usuario: string
  fecha: string
}

export function TrasladosAlmacenPage() {
  const [productos, setProductos] = useState<ApiInventoryItem[]>([])
  const [almacenes, setAlmacenes] = useState<ApiAlmacen[]>([])
  const [historial, setHistorial] = useState<TrasladoHistorialItem[]>([])
  const [lotes, setLotes] = useState<ApiLoteFefo[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [resultado, setResultado] = useState<null | {
    productoId: number
    productoNombre: string
    cantidad: number
    almacenOrigen: string
    almacenDestino: string
    lote: string
  }>(null)

  const [form, setForm] = useState({
    productoId: '', loteId: '', almacenOrigenId: '', almacenDestinoId: '', cantidad: '', motivo: '',
  })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([apiGetInventory(), apiGetAlmacenes(), apiGetTrasladosAlmacen()])
      .then(([p, a, h]) => {
        setProductos(p)
        setAlmacenes(a.filter((x: ApiAlmacen) => x.estado === 'A'))
        setHistorial(h.data || [])
      })
      .catch(() => toast.error('Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const productoId = Number(form.productoId)
    const almacenOrigenId = Number(form.almacenOrigenId)

    if (!productoId || !almacenOrigenId) {
      setLotes([])
      setForm((current) => ({ ...current, loteId: '' }))
      return
    }

    apiGetLotesDisponibles(productoId, `?almacenId=${almacenOrigenId}`)
      .then((response) => setLotes(response.data.lotes))
      .catch(() => {
        setLotes([])
        toast.error('No se pudieron cargar los lotes del almacén origen')
      })
  }, [form.productoId, form.almacenOrigenId])

  const submit = async () => {
    const productoId = Number(form.productoId)
    const loteId = Number(form.loteId || 0)
    const almacenOrigenId = Number(form.almacenOrigenId)
    const almacenDestinoId = Number(form.almacenDestinoId)
    const cantidad = Number(form.cantidad)

    if (!productoId || !almacenOrigenId || !almacenDestinoId || cantidad <= 0) {
      toast.error('Completa todos los campos'); return
    }
    if (almacenOrigenId === almacenDestinoId) {
      toast.error('Origen y destino deben ser diferentes'); return
    }

    setSubmitting(true)
    try {
      const r = await apiPostTrasladoAlmacen({
        productoId,
        loteId: loteId > 0 ? loteId : undefined,
        almacenOrigenId,
        almacenDestinoId,
        cantidad,
        motivo: form.motivo,
      })
      const producto = productos.find((item) => Number(item.id) === productoId)
      const lote = lotes.find((item) => item.id === loteId)
      setResultado({
        productoId,
        productoNombre: producto?.name || `Producto ${productoId}`,
        cantidad: r.cantidad,
        almacenOrigen: r.almacenOrigen.nombre,
        almacenDestino: r.almacenDestino.nombre,
        lote: lote?.codigoLote || (loteId > 0 ? `Lote ${loteId}` : 'FEFO automático'),
      })
      toast.success(`Trasladadas ${r.cantidad}u: ${r.almacenOrigen.nombre} → ${r.almacenDestino.nombre}`)
      setForm({ productoId: '', loteId: '', almacenOrigenId: '', almacenDestinoId: '', cantidad: '', motivo: '' })
      setLotes([])
      setShowForm(false)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error en traslado') }
    finally { setSubmitting(false) }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted">{historial.length} traslado(s) recientes</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-4 w-4" />Actualizar</Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <ArrowRightLeft className="mr-1 h-4 w-4" />{showForm ? 'Cancelar' : 'Nuevo Traslado'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Traslado entre Almacenes</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Producto</span>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.productoId}
                      onChange={e => setForm({ ...form, productoId: e.target.value })}>
                <option value="">Seleccionar producto...</option>
                {productos.filter(p => p.stock > 0).map(p => (
                  <option key={p.id} value={p.id}>{p.codigo?.trim()} — {p.name.trim()} (Stock: {p.stock})</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Almacén Origen</span>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.almacenOrigenId}
                      onChange={e => setForm({ ...form, almacenOrigenId: e.target.value })}>
                <option value="">Seleccionar origen...</option>
                {almacenes.map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} ({a.tipoAlmacen}) — {a.localNombre}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Lote</span>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.loteId}
                      onChange={e => setForm({ ...form, loteId: e.target.value })}>
                <option value="">Seleccionar automáticamente por FEFO</option>
                {lotes.map((lote) => (
                  <option key={lote.id} value={lote.id}>
                    {(lote.codigoLote || `Lote ${lote.id}`)} · {lote.cantidad}u · vence {lote.fechaVencimiento}
                  </option>
                ))}
              </select>
            </label>
            <Input placeholder="Cantidad" type="number" min="1" value={form.cantidad}
                   onChange={e => setForm({ ...form, cantidad: e.target.value })} />
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Almacén Destino</span>
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.almacenDestinoId}
                      onChange={e => setForm({ ...form, almacenDestinoId: e.target.value })}>
                <option value="">Seleccionar destino...</option>
                {almacenes.filter(a => String(a.id) !== form.almacenOrigenId).map(a => (
                  <option key={a.id} value={a.id}>{a.nombre} ({a.tipoAlmacen}) — {a.localNombre}</option>
                ))}
              </select>
            </label>
            <Input placeholder="Motivo (opcional)" className="sm:col-span-2" value={form.motivo}
                   onChange={e => setForm({ ...form, motivo: e.target.value })} />
          </div>
          <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {form.loteId
              ? 'Se trasladará el lote seleccionado.'
              : 'Si no eliges lote, el sistema moverá stock por FEFO desde el almacén origen.'}
          </div>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? 'Procesando...' : 'Ejecutar Traslado'}
          </Button>
        </Card>
      )}

      {resultado && (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <h3 className="font-semibold text-emerald-800">Último resultado</h3>
          <p className="mt-2 text-sm text-emerald-900">
            {resultado.productoNombre} · {resultado.cantidad}u · {resultado.almacenOrigen} → {resultado.almacenDestino}
          </p>
          <p className="text-xs text-emerald-700">Lote aplicado: {resultado.lote}</p>
        </Card>
      )}

      {/* Historial */}
      <div className="space-y-3">
        {historial.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">
                  {t.productoCodigo} — {t.productoNombre}
                  <Badge className="ml-2" variant="neutral">{t.cantidad}u</Badge>
                </p>
                <p className="text-sm text-muted">
                  {t.almacenOrigen?.nombre} → {t.almacenDestino?.nombre}
                </p>
                {t.detalle && <p className="text-xs text-muted mt-1">{t.detalle}</p>}
              </div>
              <div className="text-right text-xs text-muted">
                <p>{t.usuario}</p>
                <p>{t.fecha}</p>
              </div>
            </div>
          </Card>
        ))}
        {historial.length === 0 && <p className="text-center text-muted py-8">Sin traslados registrados</p>}
      </div>
    </div>
  )
}
