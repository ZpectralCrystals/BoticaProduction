import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiGetCompras, apiGetProveedores, apiGetInventory, apiGetAlmacenes, apiAddCompra } from '@/lib/api'
import type { ApiCompra, ApiProveedor, ApiInventoryItem, ApiAlmacen } from '@/lib/api'
import { PackagePlus, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const TIPOS_COMPROBANTE = ['FACTURA'] as const

type CompraFormState = {
  proveedorId: string
  tipoComprobante: 'FACTURA'
  numeroDocumento: string
  notas: string
  almacenId: string
  tipoPago: 'CONTADO' | 'CREDITO'
  fechaVencimientoFactura: string
}

type CompraItemState = {
  productoId: string
  cantidad: string
  precioUnit: string
  codigoLote: string
  fechaVencimiento: string
}

type LoadErrors = {
  compras?: string
  proveedores?: string
  productos?: string
  almacenes?: string
}

const EMPTY_FORM: CompraFormState = {
  proveedorId: '',
  tipoComprobante: 'FACTURA',
  numeroDocumento: '',
  notas: '',
  almacenId: '',
  tipoPago: 'CONTADO',
  fechaVencimientoFactura: '',
}

function buildCompraPayload(form: CompraFormState, items: CompraItemState[]) {
  return {
    proveedorId: Number(form.proveedorId || 0),
    almacenId: Number(form.almacenId || 0),
    tipoComprobante: form.tipoComprobante,
    numeroDocumento: form.numeroDocumento.trim(),
    notas: form.notas,
    tipoPago: form.tipoPago,
    fechaVencimientoFactura: form.tipoPago === 'CREDITO' ? form.fechaVencimientoFactura : '',
    items: items
      .filter((item) => item.productoId)
      .map((item) => ({
        productoId: Number(item.productoId || 0),
        cantidad: Number(item.cantidad || 1),
        precioUnit: Number(item.precioUnit || 0),
        codigoLote: item.codigoLote.trim(),
        fechaVencimiento: item.fechaVencimiento,
      })),
  }
}

function getProducto(productos: ApiInventoryItem[], productoId: string) {
  return productos.find((producto) => producto.id === productoId)
}

export function ComprasPage() {
  const [compras, setCompras] = useState<ApiCompra[]>([])
  const [proveedores, setProveedores] = useState<ApiProveedor[]>([])
  const [productos, setProductos] = useState<ApiInventoryItem[]>([])
  const [almacenes, setAlmacenes] = useState<ApiAlmacen[]>([])
  const [loading, setLoading] = useState(true)
  const [loadErrors, setLoadErrors] = useState<LoadErrors>({})
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<CompraFormState>(EMPTY_FORM)
  const [items, setItems] = useState<CompraItemState[]>([])
  const [itemErrors, setItemErrors] = useState<boolean[]>([])

  const proveedorOptions = proveedores
    .filter((provider) => provider.cestado !== 'I' && String(provider.nid).trim() && String(provider.cnombre || '').trim())
    .map((provider) => ({
      value: String(provider.nid),
      label: `${provider.cnombre.trim()} · RUC ${(provider.cruc ?? '').trim() || '-'}`,
    }))

  const almacenOptions = almacenes
    .filter((almacen) => almacen.estado === 'A')
    .map((almacen) => ({
      value: String(almacen.id),
      label: `${almacen.localNombre} · ${almacen.nombre} · ${almacen.tipoAlmacen}`,
    }))

  const load = useCallback(async () => {
    setLoading(true)
    setLoadErrors({})

    const [comprasResult, proveedoresResult, productosResult, almacenesResult] = await Promise.allSettled([
      apiGetCompras(),
      apiGetProveedores(),
      apiGetInventory(),
      apiGetAlmacenes(),
    ])

    const nextErrors: LoadErrors = {}

    if (comprasResult.status === 'fulfilled') {
      setCompras(comprasResult.value)
    } else {
      setCompras([])
      nextErrors.compras = 'No se pudieron cargar las compras'
    }

    if (proveedoresResult.status === 'fulfilled') {
      setProveedores(proveedoresResult.value)
    } else {
      setProveedores([])
      nextErrors.proveedores = 'No se pudieron cargar los proveedores'
    }

    if (productosResult.status === 'fulfilled') {
      setProductos(productosResult.value)
    } else {
      setProductos([])
      nextErrors.productos = 'No se pudieron cargar los productos'
    }

    if (almacenesResult.status === 'fulfilled') {
      setAlmacenes(almacenesResult.value)
    } else {
      setAlmacenes([])
      nextErrors.almacenes = 'No se pudieron cargar los almacenes'
    }

    setLoadErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error('La pantalla de compras se cargó con incidencias. Revise los mensajes visibles.')
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const addItem = () => setItems([...items, { productoId: '', cantidad: '1', precioUnit: '', codigoLote: '', fechaVencimiento: '' }])

  const formErrors = [
    !form.proveedorId ? 'Debe seleccionar un proveedor' : '',
    !form.almacenId ? 'Debe seleccionar un almacén destino' : '',
    !form.tipoComprobante ? 'El tipo de comprobante es obligatorio' : '',
    form.tipoComprobante && !TIPOS_COMPROBANTE.includes(form.tipoComprobante as typeof TIPOS_COMPROBANTE[number])
      ? 'En esta fase solo se permite FACTURA'
      : '',
    !form.numeroDocumento.trim() ? 'Debe ingresar el número de comprobante' : '',
    form.tipoPago === 'CREDITO' && !form.fechaVencimientoFactura
      ? 'En compras a CRÉDITO debe indicar la fecha de vencimiento de la factura'
      : '',
  ].filter(Boolean)

  const isFormValid = formErrors.length === 0

  const validateItems = (): boolean => {
    const activeItems = items.filter(i => i.productoId)
    if (activeItems.length === 0) {
      toast.error('Debe agregar al menos un producto')
      return false
    }
    const errors = items.map(i => {
      if (!i.productoId) return false
      const producto = getProducto(productos, i.productoId)
      const requiereLote = producto?.requiereLote !== false
      const requiereVencimiento = producto?.requiereVencimiento !== false
      return (requiereLote && !i.codigoLote.trim()) || (requiereVencimiento && !i.fechaVencimiento)
    })
    setItemErrors(errors)
    if (errors.some(Boolean)) {
      toast.error('Complete lote/vencimiento solo en productos que lo requieren')
      return false
    }
    return true
  }

  const submit = async () => {
    if (!isFormValid) {
      toast.error(formErrors[0] || 'Complete los datos obligatorios de la compra')
      return
    }
    if (!validateItems()) return
    setSubmitting(true)
    try {
      const payload = buildCompraPayload(form, items)
      const res = await apiAddCompra(payload)
      toast.success(`Compra ${res.codigo} registrada — S/${res.total}`)
      setShowForm(false)
      setForm(EMPTY_FORM)
      setItems([])
      setItemErrors([])
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSubmitting(false) }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Compras</p>
          <p className="text-2xl font-semibold text-foreground">{compras.length}</p>
          <p className="text-sm text-muted">Documento, proveedor, lote y entrada de stock.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? null : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancelar' : 'Nueva compra'}
        </Button>
      </Card>

      {Object.values(loadErrors).length > 0 && (
        <Card className="border-red-200 bg-red-50 p-4">
          <h3 className="font-semibold text-red-800">Incidencias de carga</h3>
          <div className="mt-2 space-y-1 text-sm text-red-700">
            {Object.values(loadErrors).map((error) => (
              <p key={error}>- {error}</p>
            ))}
          </div>
        </Card>
      )}

      {showForm && (
        <Card className="space-y-5 p-5">
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary-strong">
            <PackagePlus className="mt-0.5 h-4 w-4 shrink-0" />
            En esta fase las compras formales solo se registran con proveedor y almacén destino seleccionados, y comprobante tipo FACTURA.
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Proveedor *</span>
              <select
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={form.proveedorId}
                onChange={e => { setForm({ ...form, proveedorId: e.target.value }) }}
                disabled={proveedorOptions.length === 0}
              >
                <option value="">Seleccionar...</option>
                {proveedorOptions.map((provider) => (
                  <option key={provider.value} value={provider.value}>{provider.label}</option>
                ))}
              </select>
              {loadErrors.proveedores && <p className="text-xs text-red-600">{loadErrors.proveedores}</p>}
              {!loadErrors.proveedores && proveedorOptions.length === 0 && (
                <p className="text-xs text-amber-700">No hay proveedores activos disponibles para compras.</p>
              )}
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Tipo de comprobante *</span>
              <select className="h-10 w-full rounded-lg border border-border bg-slate-50 px-3 text-sm text-muted" value={form.tipoComprobante} disabled>
                <option value="FACTURA">FACTURA</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Número de comprobante *</span>
              <Input value={form.numeroDocumento} onChange={e => setForm({ ...form, numeroDocumento: e.target.value.toUpperCase() })} placeholder="F001-00012345" />
            </label>
            <label className="block space-y-1 lg:col-span-3">
              <span className="text-sm font-semibold">Almacén destino *</span>
              <select
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={form.almacenId}
                onChange={e => setForm({ ...form, almacenId: e.target.value })}
                disabled={almacenOptions.length === 0}
              >
                <option value="">Seleccionar...</option>
                {almacenOptions.map((almacen) => (
                  <option key={almacen.value} value={almacen.value}>{almacen.label}</option>
                ))}
              </select>
              {loadErrors.almacenes && <p className="text-xs text-red-600">{loadErrors.almacenes}</p>}
              {!loadErrors.almacenes && almacenOptions.length === 0 && (
                <p className="text-xs text-amber-700">No hay almacenes activos disponibles para registrar compras.</p>
              )}
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-semibold">Tipo de pago *</span>
              <select
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                value={form.tipoPago}
                onChange={e => setForm({ ...form, tipoPago: e.target.value as 'CONTADO' | 'CREDITO' })}
              >
                <option value="CONTADO">CONTADO (descarga caja)</option>
                <option value="CREDITO">CRÉDITO (genera cuenta por pagar)</option>
              </select>
              {form.tipoPago === 'CONTADO' && (
                <p className="text-xs text-amber-700">Requiere caja abierta asignada al usuario.</p>
              )}
            </label>
            {form.tipoPago === 'CREDITO' && (
              <label className="block space-y-1">
                <span className="text-sm font-semibold">Vencimiento factura *</span>
                <Input
                  type="date"
                  value={form.fechaVencimientoFactura}
                  onChange={e => setForm({ ...form, fechaVencimientoFactura: e.target.value })}
                />
              </label>
            )}
          </div>
          {formErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {formErrors.map((error) => (
                <p key={error}>- {error}</p>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            No hay fallback invisible de almacén en esta fase. El usuario debe decidir explícitamente a qué almacén entra el stock.
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-slate-50 p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">Productos</span>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Agregar linea
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border bg-white p-3">
                {(() => {
                  const producto = getProducto(productos, item.productoId)
                  const requiereLote = producto?.requiereLote !== false
                  const requiereVencimiento = producto?.requiereVencimiento !== false
                  return (
                    <>
                <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_110px_130px]">
                  <select className="h-10 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={item.productoId} onChange={e => { const n = [...items]; n[i].productoId = e.target.value; setItems(n) }}>
                    <option value="">Producto...</option>
                    {productos.map(p => <option key={p.id} value={p.id}>{p.name.trim()}</option>)}
                  </select>
                  <Input placeholder="Cant" value={item.cantidad} onChange={e => { const n = [...items]; n[i].cantidad = e.target.value; setItems(n) }} />
                  <Input placeholder="P.Unit" value={item.precioUnit} onChange={e => { const n = [...items]; n[i].precioUnit = e.target.value; setItems(n) }} />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <Input
                      placeholder={requiereLote ? 'Código de lote *' : 'Código de lote opcional'}
                      value={item.codigoLote}
                      onChange={e => { const n = [...items]; n[i].codigoLote = e.target.value; setItems(n); setItemErrors(prev => { const ne = [...prev]; ne[i] = false; return ne }) }}
                      className={itemErrors[i] && requiereLote && !item.codigoLote.trim() ? 'border-red-500 ring-1 ring-red-500' : ''}
                    />
                    {itemErrors[i] && requiereLote && !item.codigoLote.trim() && <p className="text-xs text-red-600">Lote obligatorio</p>}
                  </div>
                  <div className="space-y-0.5">
                    <Input
                      type="date"
                      title={requiereVencimiento ? 'Fecha vencimiento lote *' : 'Fecha vencimiento opcional'}
                      value={item.fechaVencimiento}
                      onChange={e => { const n = [...items]; n[i].fechaVencimiento = e.target.value; setItems(n); setItemErrors(prev => { const ne = [...prev]; ne[i] = false; return ne }) }}
                      className={itemErrors[i] && requiereVencimiento && !item.fechaVencimiento ? 'border-red-500 ring-1 ring-red-500' : ''}
                    />
                    {itemErrors[i] && requiereVencimiento && !item.fechaVencimiento && <p className="text-xs text-red-600">Vencimiento obligatorio</p>}
                  </div>
                </div>
                    </>
                  )
                })()}
              </div>
            ))}
          </div>
          <Button onClick={submit} disabled={!isFormValid || submitting}>
            {submitting ? 'Registrando...' : 'Registrar compra'}
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted"><th className="px-4 py-3">Codigo</th><th className="px-4 py-3">Proveedor</th><th className="px-4 py-3">Almacén destino</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Pago</th><th className="px-4 py-3">Documento</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Fecha</th></tr></thead>
            <tbody>
              {compras.map(c => (
                <tr key={c.nid} className="border-b last:border-0 hover:bg-primary/5">
                  <td className="px-4 py-3 font-mono text-xs">{c.ccodigo?.trim()}</td>
                  <td className="px-4 py-3 font-medium">{c.cproveedor?.trim()}</td>
                  <td className="px-4 py-3 text-muted">{[c.local_nombre?.trim(), c.almacen_nombre?.trim(), c.almacen_tipo?.trim()].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="px-4 py-3"><Badge variant="neutral">{c.ctipo_comprobante?.trim() || 'FACTURA'}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={c.ctipo_pago === 'CREDITO' ? 'warning' : 'success'}>{c.ctipo_pago?.trim() || 'CONTADO'}</Badge></td>
                  <td className="px-4 py-3">{c.cdocumento?.trim() || '-'}</td>
                  <td className="px-4 py-3 font-semibold">S/{parseFloat(c.ntotal).toFixed(2)}</td>
                  <td className="px-4 py-3"><Badge variant="neutral">{c.cestado?.trim()}</Badge></td>
                  <td className="px-4 py-3 text-muted">{c.tcreado}</td>
                </tr>
              ))}
              {compras.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted">Sin compras registradas</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
