import { useState } from 'react'
import { toast } from 'sonner'
import { apiGetReporte } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type ReporteData = Record<string, unknown>

function money(value: unknown) {
  return parseFloat(String(value ?? 0)).toFixed(2)
}

function pct(value: unknown) {
  return parseFloat(String(value ?? 0)).toFixed(1)
}

export function ReportesPage() {
  const [tipo, setTipo] = useState('ganancias')
  const [data, setData] = useState<ReporteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState(new Date().toISOString().slice(0, 8) + '01')
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [dias, setDias] = useState('90')

  const generar = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (tipo === 'ganancias' || tipo === 'utilidad-ventas') { params.desde = desde; params.hasta = hasta }
      if (tipo === 'vencimiento') { params.dias = dias }
      const res = await apiGetReporte(tipo, params)
      setData(res)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Tipo de reporte</span>
            <select className="w-full rounded-lg border px-3 py-2 text-sm" value={tipo} onChange={e => { setTipo(e.target.value); setData(null) }}>
              <option value="ganancias">Ganancias</option>
              <option value="utilidad-ventas">Utilidad por venta</option>
              <option value="vencimiento">Vencimiento</option>
              <option value="faltantes">Faltantes</option>
              <option value="rotacion">Rotacion</option>
              <option value="perdidas">Perdidas</option>
            </select>
          </label>
          {(tipo === 'ganancias' || tipo === 'utilidad-ventas') && <>
            <label className="block space-y-1"><span className="text-sm">Desde</span><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label>
            <label className="block space-y-1"><span className="text-sm">Hasta</span><Input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label>
          </>}
          {tipo === 'vencimiento' && <label className="block space-y-1"><span className="text-sm">Dias</span><Input type="number" value={dias} onChange={e => setDias(e.target.value)} /></label>}
          <Button onClick={generar} disabled={loading}>{loading ? 'Generando...' : 'Generar'}</Button>
        </div>
      </Card>

      {data && tipo === 'ganancias' && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-5 text-center"><p className="text-sm text-muted">Ventas</p><p className="text-2xl font-bold text-green-600">S/{parseFloat(String((data.ventas as Record<string, unknown>)?.total ?? 0)).toFixed(2)}</p><p className="text-sm text-muted">{String((data.ventas as Record<string, unknown>)?.cantidad ?? 0)} operaciones</p></Card>
            <Card className="p-5 text-center"><p className="text-sm text-muted">Costo real vendido</p><p className="text-2xl font-bold text-red-600">S/{parseFloat(String(data.costoVentas ?? 0)).toFixed(2)}</p><p className="text-sm text-muted">Según lotes consumidos</p></Card>
            <Card className="p-5 text-center"><p className="text-sm text-muted">Ganancia real</p><p className="text-2xl font-bold">S/{parseFloat(String(data.ganancia ?? 0)).toFixed(2)}</p><p className="text-sm text-muted">Ventas menos costo por lote</p></Card>
          </div>
          {(data.porDia as Record<string, unknown>[])?.length > 0 && (
            <Card className="p-6"><h3 className="font-semibold mb-3">Ventas por dia</h3>
              <div className="space-y-1">{(data.porDia as Record<string, unknown>[]).map((d, i) => (
                <div key={i} className="flex justify-between text-sm"><span>{String(d.fecha)}</span><span className="font-semibold">S/{parseFloat(String(d.total)).toFixed(2)} ({String(d.n)})</span></div>
              ))}</div>
            </Card>
          )}
        </div>
      )}

      {data && tipo === 'utilidad-ventas' && (
        <div className="space-y-4">
          {(() => {
            const resumen = (data.resumen as Record<string, unknown>) ?? {}
            const lineas = (data.lineas as Record<string, unknown>[]) ?? []
            return (
              <>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Card className="p-5 text-center"><p className="text-sm text-muted">Ingreso</p><p className="text-2xl font-bold text-green-600">S/{money(resumen.ingresoTotal)}</p><p className="text-sm text-muted">{String(resumen.ventasCantidad ?? 0)} venta(s)</p></Card>
                  <Card className="p-5 text-center"><p className="text-sm text-muted">Costo real</p><p className="text-2xl font-bold text-red-600">S/{money(resumen.costoTotal)}</p><p className="text-sm text-muted">Desde lotes consumidos</p></Card>
                  <Card className="p-5 text-center"><p className="text-sm text-muted">Utilidad</p><p className="text-2xl font-bold">S/{money(resumen.utilidadTotal)}</p><p className="text-sm text-muted">Margen {pct(resumen.margenPct)}%</p></Card>
                  <Card className="p-5 text-center"><p className="text-sm text-muted">Líneas</p><p className="text-2xl font-bold">{String(resumen.lineasCantidad ?? 0)}</p><p className="text-sm text-muted">Costo incompleto: {String(resumen.lineasSinCosto ?? 0)}</p></Card>
                </div>
                <Card className="p-6">
                  <h3 className="font-semibold mb-3">Utilidad por línea</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted">
                          <th className="pb-2">Venta</th>
                          <th className="pb-2">Fecha</th>
                          <th className="pb-2">Producto</th>
                          <th className="pb-2">Lote</th>
                          <th className="pb-2">Cant.</th>
                          <th className="pb-2">Ingreso</th>
                          <th className="pb-2">Costo</th>
                          <th className="pb-2">Utilidad</th>
                          <th className="pb-2">Margen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineas.map((row, i) => (
                          <tr key={String(row.id ?? i)} className="border-b last:border-0">
                            <td className="py-2 font-mono text-xs">{String(row.ventaCodigo ?? '')}</td>
                            <td>{String(row.ventaFecha ?? '').slice(0, 10)}</td>
                            <td>{String(row.productoNombre ?? '').trim()}</td>
                            <td><Badge variant="neutral">{String(row.loteCodigo ?? '-')}</Badge></td>
                            <td>{String(row.cantidad ?? 0)}</td>
                            <td className="font-semibold">S/{money(row.ingreso)}</td>
                            <td className="space-y-1 text-red-600">
                              <p>S/{money(row.costo)}</p>
                              {row.costoIncompleto === true && <Badge variant="warning">Costo incompleto</Badge>}
                            </td>
                            <td className={Number(row.utilidad ?? 0) >= 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>S/{money(row.utilidad)}</td>
                            <td>{pct(row.margenPct)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )
          })()}
        </div>
      )}

      {data && tipo === 'vencimiento' && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">{String(data.total ?? 0)} lote(s) por vencer</h3>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted"><th className="pb-2">Codigo</th><th className="pb-2">Producto</th><th className="pb-2">Lote</th><th className="pb-2">Familia</th><th className="pb-2">Stock lote</th><th className="pb-2">Almacén</th><th className="pb-2">Vence</th><th className="pb-2">Dias</th></tr></thead><tbody>
            {(data.items as Record<string, unknown>[])?.map((p, i) => (
              <tr key={i} className="border-b last:border-0"><td className="py-2 font-mono text-xs">{String(p.ccodigo)}</td><td>{String(p.cnombre).trim()}</td><td><Badge variant="neutral">{String(p.ccodigo_lote ?? '-')}</Badge></td><td>{String(p.cfamilia ?? '').trim()}</td><td>{String(p.stock_lote ?? p.nstock)}</td><td>{[p.local_nombre, p.almacen_nombre].filter(Boolean).map(String).join(' · ') || '-'}</td><td>{String(p.fecha_vencimiento_lote ?? p.tvencimien)}</td><td className="font-semibold">{String(p.dias_restantes)}</td></tr>
            ))}
          </tbody></table></div>
        </Card>
      )}

      {data && tipo === 'faltantes' && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">{String(data.total ?? 0)} producto(s) con stock bajo</h3>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted"><th className="pb-2">Codigo</th><th className="pb-2">Nombre</th><th className="pb-2">Stock</th><th className="pb-2">Minimo</th><th className="pb-2">Faltante</th><th className="pb-2">Proveedor</th></tr></thead><tbody>
            {(data.items as Record<string, unknown>[])?.map((p, i) => (
              <tr key={i} className="border-b last:border-0"><td className="py-2 font-mono text-xs">{String(p.ccodigo)}</td><td>{String(p.cnombre).trim()}</td><td className="text-red-600 font-semibold">{String(p.nstock)}</td><td>{String(p.nstockmin)}</td><td className="font-semibold">{String(p.faltante)}</td><td>{String(p.cproveedor ?? '').trim()}</td></tr>
            ))}
          </tbody></table></div>
        </Card>
      )}

      {data && tipo === 'rotacion' && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Rotacion por familia</h3>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted"><th className="pb-2">Familia</th><th className="pb-2">Rotacion</th><th className="pb-2">Productos</th><th className="pb-2">Stock total</th><th className="pb-2">Valor inventario</th></tr></thead><tbody>
            {(data.items as Record<string, unknown>[])?.map((p, i) => (
              <tr key={i} className="border-b last:border-0"><td className="py-2">{String(p.cfamilia ?? '').trim()}</td><td><Badge variant="neutral">{String(p.crotacion)}</Badge></td><td>{String(p.productos)}</td><td>{String(p.stock_total)}</td><td className="font-semibold">S/{parseFloat(String(p.valor_inventario ?? 0)).toFixed(2)}</td></tr>
            ))}
          </tbody></table></div>
        </Card>
      )}

      {data && tipo === 'perdidas' && (
        <div className="space-y-4">
          <Card className="p-5 text-center"><p className="text-sm text-muted">Perdida total estimada</p><p className="text-2xl font-bold text-red-600">S/{parseFloat(String(data.totalPerdida ?? 0)).toFixed(2)}</p></Card>
          <Card className="p-6"><h3 className="font-semibold mb-3">Productos vencidos ({(data.vencidos as Record<string, unknown>)?.total ? `S/${parseFloat(String((data.vencidos as Record<string, unknown>).total)).toFixed(2)}` : 'S/0'})</h3>
            <div className="space-y-1">{((data.vencidos as Record<string, unknown>)?.items as Record<string, unknown>[])?.map((p, i) => (
              <div key={i} className="flex justify-between text-sm"><span>{String(p.cnombre).trim()}</span><span className="text-red-600">S/{parseFloat(String(p.valor_perdida ?? 0)).toFixed(2)} ({String(p.nstock)} uds)</span></div>
            ))}</div>
          </Card>
        </div>
      )}
    </div>
  )
}
