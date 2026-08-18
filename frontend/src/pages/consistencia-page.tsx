import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle, RefreshCw, ShieldAlert, XCircle } from 'lucide-react'
import {
  apiGetConsistenciaResumen, apiGetConsistenciaStock, apiGetConsistenciaLotes,
  apiPostReconciliar, apiPostMarcarVencidos, apiGetAlertas,
} from '@/lib/api'
import type {
  ApiConsistenciaResumen, ApiConsistenciaStockResponse, ApiConsistenciaLotesResponse, ApiAlertasResponse,
} from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const severidadColor: Record<string, string> = {
  CRITICA: 'bg-red-100 text-red-800',
  MEDIA: 'bg-amber-100 text-amber-800',
  BAJA: 'bg-blue-100 text-blue-800',
  OK: 'bg-emerald-100 text-emerald-800',
}

const estadoIcon: Record<string, typeof CheckCircle> = {
  CRITICA: XCircle, MEDIA: AlertTriangle, BAJA: ShieldAlert, OK: CheckCircle,
}

export function ConsistenciaPage() {
  const [resumen, setResumen] = useState<ApiConsistenciaResumen | null>(null)
  const [stock, setStock] = useState<ApiConsistenciaStockResponse | null>(null)
  const [lotes, setLotes] = useState<ApiConsistenciaLotesResponse | null>(null)
  const [alertas, setAlertas] = useState<ApiAlertasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([apiGetConsistenciaResumen(), apiGetConsistenciaStock(), apiGetConsistenciaLotes(), apiGetAlertas()])
      .then(([r, s, l, a]) => { setResumen(r); setStock(s); setLotes(l); setAlertas(a) })
      .catch(() => toast.error('Error al cargar consistencia'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const doReconciliar = async (dryRun: boolean) => {
    setActing(true)
    try {
      const r = await apiPostReconciliar(dryRun)
      if (dryRun) {
        toast.info(`Dry-run: ${r.totalCorregidos} producto(s) serían corregidos`)
      } else {
        toast.success(`Reconciliados ${r.totalCorregidos} producto(s)`)
        load()
      }
    } catch { toast.error('Error en reconciliación') }
    finally { setActing(false) }
  }

  const doMarcarVencidos = async (dryRun: boolean) => {
    setActing(true)
    try {
      const r = await apiPostMarcarVencidos(dryRun)
      if (dryRun) {
        toast.info(`Dry-run: ${r.totalMarcados} lote(s) serían marcados`)
      } else {
        toast.success(`Marcados ${r.totalMarcados} lote(s) como VENCIDO`)
        load()
      }
    } catch { toast.error('Error al marcar vencidos') }
    finally { setActing(false) }
  }

  if (loading) return <p className="p-6 text-muted">Cargando consistencia...</p>

  return (
    <div className="space-y-6">
      {/* Resumen ejecutivo */}
      {resumen && (
        <div className="grid gap-4 sm:grid-cols-4 xl:grid-cols-6">
          <Card className="p-4 text-center">
            <p className="text-sm text-muted">Estado General</p>
            <Badge className={`mt-1 text-lg ${severidadColor[resumen.estadoGeneral]}`}>{resumen.estadoGeneral}</Badge>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-sm text-muted">Inconsistencias</p>
            <p className="text-2xl font-bold">{resumen.totalInconsistencias}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-sm text-muted">Stock Vendible</p>
            <p className="text-2xl font-bold text-emerald-700">{resumen.stockVendible}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-sm text-muted">Stock No Vendible</p>
            <p className="text-2xl font-bold text-amber-700">{resumen.stockNoVendible}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-sm text-muted">Lotes Sin Almacén</p>
            <p className="text-2xl font-bold text-amber-700">{lotes?.sinAlmacen.total ?? 0}</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-sm text-muted">Stock Fantasma</p>
            <p className="text-2xl font-bold text-red-700">{alertas?.stockFantasma.total ?? 0}</p>
          </Card>
        </div>
      )}

      {/* Checks detallados */}
      {resumen && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">Verificaciones de Integridad</h3>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="mr-1 h-4 w-4" /> Actualizar
            </Button>
          </div>
          <div className="space-y-2">
            {resumen.checks.map((c) => {
              const Icon = estadoIcon[c.severidad] || CheckCircle
              return (
                <div key={c.check} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <Icon className={`h-5 w-5 shrink-0 ${c.severidad === 'OK' ? 'text-emerald-600' : c.severidad === 'CRITICA' ? 'text-red-600' : 'text-amber-600'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{c.check.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted">{c.descripcion}</p>
                  </div>
                  <Badge className={severidadColor[c.severidad]}>{c.inconsistencias}</Badge>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Acciones */}
      <Card className="p-5">
        <h3 className="mb-3 font-semibold">Acciones de Corrección</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" onClick={() => doReconciliar(true)} disabled={acting}>
            Reconciliar (dry-run)
          </Button>
          <Button size="sm" onClick={() => doReconciliar(false)} disabled={acting}
                  className="bg-amber-600 hover:bg-amber-700 text-white">
            Reconciliar (aplicar)
          </Button>
          <Button variant="outline" size="sm" onClick={() => doMarcarVencidos(true)} disabled={acting}>
            Marcar vencidos (dry-run)
          </Button>
          <Button size="sm" onClick={() => doMarcarVencidos(false)} disabled={acting}
                  className="bg-red-600 hover:bg-red-700 text-white">
            Marcar vencidos (aplicar)
          </Button>
        </div>
      </Card>

      {/* Stock inconsistencias */}
      {stock && stock.totalInconsistencias > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">
            Inconsistencias Stock vs Lotes
            <Badge className="ml-2 bg-red-100 text-red-800">{stock.totalInconsistencias}</Badge>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted">
                <th className="pb-2">Producto</th><th className="pb-2">Stock Tabla</th>
                <th className="pb-2">Stock Lotes</th><th className="pb-2">Diferencia</th><th className="pb-2">Severidad</th>
              </tr></thead>
              <tbody>
                {stock.inconsistencias.map((i) => (
                  <tr key={i.productoId} className="border-b">
                    <td className="py-2">{i.productoCodigo} — {i.productoNombre}</td>
                    <td className="py-2">{i.stockTabla}</td>
                    <td className="py-2">{i.stockLotesActivos}</td>
                    <td className="py-2 font-bold">{i.diferencia > 0 ? '+' : ''}{i.diferencia}</td>
                    <td className="py-2"><Badge className={severidadColor[i.severidad]}>{i.severidad}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lotes con problemas */}
      {lotes && (
        <>
          {lotes.vencidosNoMarcados.total > 0 && (
            <Card className="border-red-200 p-5">
              <h3 className="mb-3 font-semibold text-red-700">
                Lotes Vencidos Sin Marcar
                <Badge className="ml-2 bg-red-100 text-red-800">{lotes.vencidosNoMarcados.total}</Badge>
              </h3>
              <div className="space-y-1 text-sm">
                {lotes.vencidosNoMarcados.items.map((l) => (
                  <p key={l.loteId}>• {l.productoNombre} — Lote {l.codigoLote || l.loteId} — {l.cantidad}u — Venc: {l.vencimiento}</p>
                ))}
              </div>
            </Card>
          )}
          {lotes.sinAlmacen.total > 0 && (
            <Card className="border-amber-200 p-5">
              <h3 className="mb-3 font-semibold text-amber-700">
                Lotes Sin Almacén
                <Badge className="ml-2 bg-amber-100 text-amber-800">{lotes.sinAlmacen.total}</Badge>
              </h3>
              <div className="space-y-1 text-sm">
                {lotes.sinAlmacen.items.map((l) => (
                  <p key={l.loteId}>• {l.productoNombre} — Lote {l.codigoLote || l.loteId} — {l.cantidad}u</p>
                ))}
              </div>
            </Card>
          )}
          {alertas && alertas.stockFantasma.total > 0 && (
            <Card className="border-red-200 p-5">
              <h3 className="mb-3 font-semibold text-red-700">
                Stock Fantasma
                <Badge className="ml-2 bg-red-100 text-red-800">{alertas.stockFantasma.total}</Badge>
              </h3>
              <div className="space-y-1 text-sm">
                {alertas.stockFantasma.items.map((item, index) => (
                  <p key={`${item.productoId}-${index}`}>
                    • {String(item.productoCodigo)} — {String(item.productoNombre)} — <strong>{String(item.stockSinLotes ?? '')}u</strong> sin lotes asociados
                  </p>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {resumen?.estadoGeneral === 'OK' && stock?.totalInconsistencias === 0 && (
        <Card className="border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
          <p className="font-semibold text-emerald-800">Sistema consistente</p>
          <p className="text-sm text-emerald-700">No se detectaron inconsistencias de stock, lotes ni kardex.</p>
        </Card>
      )}
    </div>
  )
}
