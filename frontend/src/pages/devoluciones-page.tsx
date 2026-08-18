import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw, Truck } from 'lucide-react'
import {
  apiGetInventory, apiGetAlmacenes, apiPostDevolucionCliente, apiPostDevolucionProveedor, apiGetLotesDisponibles,
} from '@/lib/api'
import type { ApiInventoryItem, ApiAlmacen, ApiLoteFefo } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type TipoDevolucion = 'cliente' | 'proveedor'

export function DevolucionesPage() {
  const [productos, setProductos] = useState<ApiInventoryItem[]>([])
  const [almacenes, setAlmacenes] = useState<ApiAlmacen[]>([])
  const [lotes, setLotes] = useState<ApiLoteFefo[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tipo, setTipo] = useState<TipoDevolucion>('cliente')
  const [resultado, setResultado] = useState<string | null>(null)

  const [form, setForm] = useState({
    productoId: '', almacenId: '', loteId: '', cantidad: '', motivo: '',
  })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([apiGetInventory(), apiGetAlmacenes()])
      .then(([p, a]) => {
        setProductos(p)
        setAlmacenes(a.filter((x: ApiAlmacen) => x.estado === 'A'))
      })
      .catch(() => toast.error('Error al cargar'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setForm((current) => ({ ...current, almacenId: '', loteId: '' }))
    setLotes([])
  }, [tipo])

  useEffect(() => {
    if (tipo === 'cliente') {
      const cuarentena = almacenes.find((almacen) => almacen.tipoAlmacen === 'CUARENTENA')
      if (cuarentena && !form.almacenId) {
        setForm((current) => ({ ...current, almacenId: String(cuarentena.id) }))
      }
    }
  }, [tipo, almacenes, form.almacenId])

  useEffect(() => {
    const productoId = Number(form.productoId)
    const almacenId = Number(form.almacenId)

    if (!productoId || !almacenId) {
      setLotes([])
      setForm((current) => ({ ...current, loteId: '' }))
      return
    }

    if (tipo === 'cliente') {
      setLotes([])
      return
    }

    apiGetLotesDisponibles(productoId, `?almacenId=${almacenId}`)
      .then((response) => setLotes(response.data.lotes))
      .catch(() => {
        setLotes([])
        toast.error('No se pudieron cargar los lotes del almacén seleccionado')
      })
  }, [tipo, form.productoId, form.almacenId])

  const submit = async () => {
    const productoId = Number(form.productoId)
    const almacenId = Number(form.almacenId)
    const loteId = Number(form.loteId || 0)
    const cantidad = Number(form.cantidad)

    if (!productoId || !almacenId || cantidad <= 0) {
      toast.error('Completa todos los campos'); return
    }

    setSubmitting(true)
    try {
      if (tipo === 'cliente') {
        const r = await apiPostDevolucionCliente({
          productoId,
          almacenDestinoId: almacenId,
          cantidad,
          motivo: form.motivo,
          loteId: loteId > 0 ? loteId : undefined,
        })
        setResultado(`Devolución cliente registrada: +${r.cantidad}u al almacén ${r.almacen}.`)
        toast.success(`Devolución cliente: +${r.cantidad}u → ${r.almacen}`)
      } else {
        const r = await apiPostDevolucionProveedor({
          productoId,
          almacenOrigenId: almacenId,
          cantidad,
          motivo: form.motivo,
          loteId: loteId > 0 ? loteId : undefined,
        })
        setResultado(`Devolución proveedor registrada: -${r.cantidad}u desde ${r.almacenOrigen}.`)
        toast.success(`Devolución proveedor: -${r.cantidad}u ← ${r.almacenOrigen}`)
      }
      setForm({ productoId: '', almacenId: '', loteId: '', cantidad: '', motivo: '' })
      setLotes([])
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error en devolución') }
    finally { setSubmitting(false) }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  // Filter almacenes based on return type
  const almacenesFiltered = tipo === 'cliente'
    ? almacenes // Customer return: can go to any warehouse (typically quarantine)
    : almacenes.filter(a => a.stockTotal > 0) // Supplier return: needs stock in origin

  return (
    <div className="space-y-6">
      {/* Tab selector */}
      <div className="flex gap-2">
        <Button
          variant={tipo === 'cliente' ? 'default' : 'outline'}
          onClick={() => setTipo('cliente')}
        >
          <RotateCcw className="mr-1 h-4 w-4" /> Devolución Cliente
        </Button>
        <Button
          variant={tipo === 'proveedor' ? 'default' : 'outline'}
          onClick={() => setTipo('proveedor')}
        >
          <Truck className="mr-1 h-4 w-4" /> Devolución Proveedor
        </Button>
      </div>

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">
          {tipo === 'cliente' ? 'Devolución de Cliente' : 'Devolución a Proveedor'}
        </h3>
        <p className="text-sm text-muted">
          {tipo === 'cliente'
            ? 'El producto devuelto por el cliente se ingresa al almacén seleccionado (ej: Cuarentena para revisión).'
            : 'El producto se retira del almacén seleccionado y se devuelve al proveedor.'}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Producto</span>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.productoId}
                    onChange={e => setForm({ ...form, productoId: e.target.value })}>
              <option value="">Seleccionar producto...</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.codigo?.trim()} — {p.name.trim()} (Stock: {p.stock})</option>
                ))}
              </select>
            </label>
            <Input placeholder="Cantidad" type="number" min="1" value={form.cantidad}
                 onChange={e => setForm({ ...form, cantidad: e.target.value })} />
          <label className="block space-y-1">
            <span className="text-sm font-semibold">
              {tipo === 'cliente' ? 'Almacén Destino' : 'Almacén Origen'}
            </span>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.almacenId}
                    onChange={e => setForm({ ...form, almacenId: e.target.value })}>
              <option value="">Seleccionar almacén...</option>
              {almacenesFiltered.map(a => (
                <option key={a.id} value={a.id}>
                  {a.nombre} ({a.tipoAlmacen})
                  {tipo === 'cliente' && a.tipoAlmacen === 'CUARENTENA' ? ' ← Recomendado' : ''}
                  {a.localNombre ? ` — ${a.localNombre}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Lote</span>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.loteId}
                    onChange={e => setForm({ ...form, loteId: e.target.value })} disabled={tipo === 'cliente'}>
              <option value="">
                {tipo === 'cliente' ? 'Se generará/ajustará lote de devolución' : 'Seleccionar automáticamente por FEFO'}
              </option>
              {lotes.map((lote) => (
                <option key={lote.id} value={lote.id}>
                  {(lote.codigoLote || `Lote ${lote.id}`)} · {lote.cantidad}u · vence {lote.fechaVencimiento}
                </option>
              ))}
            </select>
          </label>
          <Input placeholder="Motivo" value={form.motivo}
                 onChange={e => setForm({ ...form, motivo: e.target.value })} />
        </div>

        {tipo === 'cliente' && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <strong>Política:</strong> Las devoluciones de cliente deben ingresar a Cuarentena para revisión antes de ser reintegradas al stock vendible.
          </div>
        )}

        <Button onClick={submit} disabled={submitting}>
          {submitting ? 'Procesando...' : tipo === 'cliente' ? 'Registrar Devolución' : 'Devolver a Proveedor'}
        </Button>
      </Card>

      {resultado && (
        <Card className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Resultado:</strong> {resultado}
        </Card>
      )}

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <h4 className="font-semibold mb-2">Devolución Cliente</h4>
          <ul className="text-sm text-muted space-y-1">
            <li>• Ingresa stock al almacén seleccionado</li>
            <li>• Incrementa bot_productos.nstock</li>
            <li>• Registra kardex + movimiento almacén</li>
            <li>• Típicamente va a <Badge variant="neutral">CUARENTENA</Badge></li>
          </ul>
        </Card>
        <Card className="p-4">
          <h4 className="font-semibold mb-2">Devolución Proveedor</h4>
          <ul className="text-sm text-muted space-y-1">
            <li>• Retira stock del almacén seleccionado</li>
            <li>• Decrementa bot_productos.nstock</li>
            <li>• Descuenta de lotes por FEFO</li>
            <li>• Registra kardex + movimiento almacén</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
