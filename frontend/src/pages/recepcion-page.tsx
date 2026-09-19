import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { apiAddRecepcion, apiGetCompraDetalle, apiGetCompras, apiGetRecepciones } from '@/lib/api'
import type { ApiCompra, ApiCompraDetalle, ApiRecepcion } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

function getCompraPendiente(compra: ApiCompra) {
  const pendiente = Number(compra.cantidad_pendiente ?? 0)
  if (Number.isFinite(pendiente) && pendiente > 0) return pendiente
  if (!compra.cantidad_pendiente && compra.recepcion_estado !== 'RECIBIDA') {
    return Number(compra.cantidad_esperada ?? 0)
  }
  return 0
}

function getRecepcionEstado(compra: ApiCompra) {
  return (compra.recepcion_estado || 'PENDIENTE').trim().toUpperCase()
}

export function RecepcionPage() {
  const [recepciones, setRecepciones] = useState<ApiRecepcion[]>([])
  const [compras, setCompras] = useState<ApiCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [mostrarTodasCompras, setMostrarTodasCompras] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ compraId: '', notas: '', incidencias: '' })
  const [detalle, setDetalle] = useState<ApiCompraDetalle[]>([])
  const [detalleLoading, setDetalleLoading] = useState(false)
  const [lineas, setLineas] = useState<Record<string, { recibido: string; incidencia: string }>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [recep, comp] = await Promise.all([apiGetRecepciones(), apiGetCompras()])
      setRecepciones(recep)
      setCompras(comp)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar recepción')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const selectCompra = async (compraId: string) => {
    setForm({ ...form, compraId })
    setDetalle([])
    setLineas({})
    if (!compraId) return
    setDetalleLoading(true)
    try {
      const res = await apiGetCompraDetalle(compraId)
      setDetalle(res.detalle)
      const next: Record<string, { recibido: string; incidencia: string }> = {}
      for (const row of res.detalle) {
        next[row.nid] = { recibido: String(row.cantidad_pendiente ?? row.ncantidad ?? '0'), incidencia: '' }
      }
      setLineas(next)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar detalle de compra')
    } finally {
      setDetalleLoading(false)
    }
  }

  const submit = async () => {
    if (!form.compraId) {
      toast.error('Seleccione compra')
      return
    }
    setSaving(true)
    try {
      const res = await apiAddRecepcion({
        compraId: Number(form.compraId),
        notas: form.notas,
        incidencias: form.incidencias,
        items: detalle.map(row => ({
          detalleId: Number(row.nid),
          productoId: Number(row.nproducto_id),
          cantidadEsperada: Number(row.ncantidad || 0),
          cantidadRecibida: Number(lineas[row.nid]?.recibido || 0),
          incidencia: lineas[row.nid]?.incidencia || '',
        })),
      })
      toast.success(`Recepción ${res.codigo} registrada`)
      setShowForm(false)
      setForm({ compraId: '', notas: '', incidencias: '' })
      setDetalle([])
      setLineas({})
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al registrar recepción')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  const comprasPendientes = compras.filter((compra) => getRecepcionEstado(compra) !== 'RECIBIDA' && getCompraPendiente(compra) > 0)
  const comprasVisibles = mostrarTodasCompras ? compras : comprasPendientes
  const comprasParciales = compras.filter((compra) => getRecepcionEstado(compra) === 'PARCIAL')
  const faltantesTotal = compras.reduce((total, compra) => total + getCompraPendiente(compra), 0)
  const faltantesPorProveedor = compras
    .reduce<Array<{ proveedor: string; compras: number; pendiente: number }>>((acc, compra) => {
      const pendiente = getCompraPendiente(compra)
      if (pendiente <= 0) return acc
      const proveedor = compra.cproveedor?.trim() || 'Sin proveedor'
      const current = acc.find((row) => row.proveedor === proveedor)
      if (current) {
        current.compras += 1
        current.pendiente += pendiente
      } else {
        acc.push({ proveedor, compras: 1, pendiente })
      }
      return acc
    }, [])
    .sort((a, b) => b.pendiente - a.pendiente)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{recepciones.length} recepción(es) registrada(s)</p>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancelar' : 'Nueva recepción'}</Button>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Recepción confirma llegada física. Stock, lotes y kardex se actualizan aquí, no al registrar compra.
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Compras pendientes</p>
          <p className="text-2xl font-bold">{comprasPendientes.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Recepción parcial</p>
          <p className="text-2xl font-bold">{comprasParciales.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted">Unidades faltantes</p>
          <p className="text-2xl font-bold">{faltantesTotal}</p>
        </Card>
      </div>

      {showForm && (
        <Card className="p-6 space-y-4">
          <label className="block space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Compra *</span>
              <Button type="button" variant="outline" onClick={() => setMostrarTodasCompras(!mostrarTodasCompras)}>
                {mostrarTodasCompras ? 'Ver solo pendientes' : 'Ver todas'}
              </Button>
            </div>
            <select
              className="w-full rounded-lg border px-3 py-2 text-sm"
              value={form.compraId}
              onChange={e => void selectCompra(e.target.value)}
            >
              <option value="">Seleccionar compra...</option>
              {comprasVisibles.map(compra => (
                <option key={compra.nid} value={compra.nid}>
                  {compra.ccodigo} · {getRecepcionEstado(compra)} · pendiente {getCompraPendiente(compra)} · {compra.cproveedor} · {compra.cdocumento || '-'} · S/{Number(compra.ntotal || 0).toFixed(2)}
                </option>
              ))}
            </select>
            {!mostrarTodasCompras && comprasPendientes.length === 0 && (
              <p className="text-xs text-muted">No hay compras pendientes por recibir.</p>
            )}
          </label>

          {detalleLoading && <p className="text-sm text-muted">Cargando detalle...</p>}

          {detalle.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-muted">
                    <th className="px-3 py-2">Producto</th>
                    <th className="px-3 py-2">Esperado</th>
                    <th className="px-3 py-2">Pendiente</th>
                    <th className="px-3 py-2">Recibido físico</th>
                    <th className="px-3 py-2">Lote</th>
                    <th className="px-3 py-2">Vencimiento</th>
                    <th className="px-3 py-2">Incidencia línea</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.map(row => {
                    const pendiente = Number(row.cantidad_pendiente ?? row.ncantidad ?? 0)
                    return (
                      <tr key={row.nid} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium">{row.producto_nombre || `Producto ${row.nproducto_id}`}</td>
                        <td className="px-3 py-2">{Number(row.ncantidad || 0)}</td>
                        <td className="px-3 py-2">{pendiente}</td>
                        <td className="px-3 py-2">
                          <div className="space-y-2">
                            <Input
                              min="0"
                              type="number"
                              value={lineas[row.nid]?.recibido || '0'}
                              onChange={e => setLineas({
                                ...lineas,
                                [row.nid]: { recibido: e.target.value, incidencia: lineas[row.nid]?.incidencia || '' },
                              })}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setLineas({
                                  ...lineas,
                                  [row.nid]: { recibido: String(pendiente), incidencia: lineas[row.nid]?.incidencia || '' },
                                })}
                              >
                                Recibir saldo
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setLineas({
                                  ...lineas,
                                  [row.nid]: { recibido: '0', incidencia: lineas[row.nid]?.incidencia || 'No llegó' },
                                })}
                              >
                                No llegó
                              </Button>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{row.ccodigo_lote || '-'}</td>
                        <td className="px-3 py-2 text-xs">{row.dfecha_vencimiento || '-'}</td>
                        <td className="px-3 py-2">
                          <Input
                            value={lineas[row.nid]?.incidencia || ''}
                            onChange={e => setLineas({
                              ...lineas,
                              [row.nid]: { recibido: lineas[row.nid]?.recibido || '0', incidencia: e.target.value },
                            })}
                            placeholder="Ej: faltan cajas"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Incidencias</span>
            <Input
              value={form.incidencias}
              onChange={e => setForm({ ...form, incidencias: e.target.value })}
              placeholder="Ej: faltan 2 cajas de amoxicilina, caja dañada, etc."
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Notas</span>
            <Input
              value={form.notas}
              onChange={e => setForm({ ...form, notas: e.target.value })}
              placeholder="Observación de recepción"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button onClick={submit} disabled={saving || detalle.length === 0}>{saving ? 'Guardando...' : 'Confirmar recepción'}</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Faltantes por proveedor</h3>
            <p className="text-sm text-muted">Compras con saldo físico aún no recibido.</p>
          </div>
          <Badge variant={faltantesTotal > 0 ? 'warning' : 'success'}>{faltantesTotal > 0 ? 'Con faltantes' : 'Al día'}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted">
                <th className="pb-2">Proveedor</th>
                <th className="pb-2">Compras abiertas</th>
                <th className="pb-2">Unidades pendientes</th>
              </tr>
            </thead>
            <tbody>
              {faltantesPorProveedor.map(row => (
                <tr key={row.proveedor} className="border-b last:border-0">
                  <td className="py-2">{row.proveedor}</td>
                  <td>{row.compras}</td>
                  <td className="font-semibold text-warning">{row.pendiente}</td>
                </tr>
              ))}
              {faltantesPorProveedor.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted">Sin faltantes pendientes</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted">
                <th className="pb-2">Código</th>
                <th className="pb-2">Compra</th>
                <th className="pb-2">Proveedor</th>
                <th className="pb-2">Incidencias</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recepciones.map(row => (
                <tr key={row.nid} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{row.ccodigo}</td>
                  <td>{row.compra_codigo || '-'}</td>
                  <td>{row.cproveedor || '-'}</td>
                  <td className="max-w-[320px] truncate text-muted">{row.cincidencias || row.cnotas || '-'}</td>
                  <td><Badge variant="success">{row.cestado}</Badge></td>
                  <td className="text-xs text-muted">{row.tcreado}</td>
                </tr>
              ))}
              {recepciones.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted">Sin recepciones registradas</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
