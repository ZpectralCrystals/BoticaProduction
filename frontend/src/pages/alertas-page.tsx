import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Clock, Package, ShieldAlert, RefreshCw } from 'lucide-react'
import { apiGetAlertas } from '@/lib/api'
import type { ApiAlertasResponse } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function AlertasPage() {
  const [data, setData] = useState<ApiAlertasResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    apiGetAlertas()
      .then(setData)
      .catch(() => toast.error('Error al cargar alertas'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <p className="p-6 text-muted">Cargando alertas...</p>
  if (!data) return <p className="p-6 text-muted">Sin datos</p>

  const totalAlertas = data.porVencer.total + data.enCuarentena.total + data.enBaja.total + data.stockFantasma.total
  const stockNoVendible = data.resumen?.stockNoVendible ?? (data.enCuarentena.totalUnidades + data.enBaja.totalUnidades)
  const alertasCriticas = data.resumen?.alertasCriticas ?? (
    data.porVencer.items.filter((item) => Number(item.dias ?? 0) <= 7).length +
    data.enBaja.total +
    data.stockFantasma.total
  )

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Card className="border-red-200 p-4 text-center">
          <Clock className="mx-auto mb-1 h-5 w-5 text-red-600" />
          <p className="text-sm text-muted">Por Vencer (30d)</p>
          <p className="text-2xl font-bold text-red-700">{data.porVencer.total}</p>
        </Card>
        <Card className="border-amber-200 p-4 text-center">
          <ShieldAlert className="mx-auto mb-1 h-5 w-5 text-amber-600" />
          <p className="text-sm text-muted">En Cuarentena</p>
          <p className="text-2xl font-bold text-amber-700">{data.enCuarentena.totalUnidades || 0}u</p>
          <p className="text-xs text-muted">{data.enCuarentena.total} producto(s)</p>
        </Card>
        <Card className="border-red-200 p-4 text-center">
          <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-red-600" />
          <p className="text-sm text-muted">En Baja</p>
          <p className="text-2xl font-bold text-red-700">{data.enBaja.totalUnidades || 0}u</p>
          <p className="text-xs text-muted">{data.enBaja.total} producto(s)</p>
        </Card>
        <Card className="border-purple-200 p-4 text-center">
          <Package className="mx-auto mb-1 h-5 w-5 text-purple-600" />
          <p className="text-sm text-muted">Stock Fantasma</p>
          <p className="text-2xl font-bold text-purple-700">{data.stockFantasma.total}</p>
        </Card>
        <Card className="border-slate-200 p-4 text-center">
          <ShieldAlert className="mx-auto mb-1 h-5 w-5 text-slate-700" />
          <p className="text-sm text-muted">Stock No Vendible</p>
          <p className="text-2xl font-bold text-slate-900">{stockNoVendible}u</p>
        </Card>
        <Card className="border-rose-200 p-4 text-center">
          <AlertTriangle className="mx-auto mb-1 h-5 w-5 text-rose-700" />
          <p className="text-sm text-muted">Alertas Críticas</p>
          <p className="text-2xl font-bold text-rose-700">{alertasCriticas}</p>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-1 h-4 w-4" /> Actualizar
        </Button>
      </div>

      {/* Por vencer */}
      {data.porVencer.total > 0 && (
        <Card className="border-red-200 p-5">
          <h3 className="mb-3 font-semibold text-red-700">
            Lotes Por Vencer (próximos 30 días)
            <Badge className="ml-2 bg-red-100 text-red-800">{data.porVencer.total}</Badge>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted">
                <th className="pb-2">Producto</th><th className="pb-2">Lote</th>
                <th className="pb-2">Vencimiento</th><th className="pb-2">Días</th>
                <th className="pb-2">Cantidad</th><th className="pb-2">Almacén</th>
              </tr></thead>
              <tbody>
                {data.porVencer.items.map((i, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="py-2">{i.productoCodigo} — {i.productoNombre}</td>
                    <td className="py-2">{String(i.codigoLote ?? '')}</td>
                    <td className="py-2">{String(i.vencimiento ?? '')}</td>
                    <td className="py-2"><Badge className={Number(i.dias ?? 0) <= 7 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{String(i.dias ?? '')}d</Badge></td>
                    <td className="py-2">{String(i.cantidad ?? '')}</td>
                    <td className="py-2 text-muted">{String(i.almacen ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* En cuarentena */}
      {data.enCuarentena.total > 0 && (
        <Card className="border-amber-200 p-5">
          <h3 className="mb-3 font-semibold text-amber-700">
            Stock en Cuarentena
            <Badge className="ml-2 bg-amber-100 text-amber-800">{data.enCuarentena.totalUnidades}u</Badge>
          </h3>
          <div className="space-y-1 text-sm">
            {data.enCuarentena.items.map((i, idx) => (
              <p key={idx}>• {i.productoCodigo} — {i.productoNombre} — <strong>{String(i.stock ?? '')}u</strong> en {String(i.almacen ?? '')}</p>
            ))}
          </div>
        </Card>
      )}

      {/* En baja */}
      {data.enBaja.total > 0 && (
        <Card className="border-red-200 p-5">
          <h3 className="mb-3 font-semibold text-red-700">
            Stock en Baja
            <Badge className="ml-2 bg-red-100 text-red-800">{data.enBaja.totalUnidades}u</Badge>
          </h3>
          <div className="space-y-1 text-sm">
            {data.enBaja.items.map((i, idx) => (
              <p key={idx}>• {i.productoCodigo} — {i.productoNombre} — <strong>{String(i.stock ?? '')}u</strong> en {String(i.almacen ?? '')}</p>
            ))}
          </div>
        </Card>
      )}

      {/* Stock fantasma */}
      {data.stockFantasma.total > 0 && (
        <Card className="border-purple-200 p-5">
          <h3 className="mb-3 font-semibold text-purple-700">
            Stock Fantasma (sin lotes)
            <Badge className="ml-2 bg-purple-100 text-purple-800">{data.stockFantasma.total}</Badge>
          </h3>
          <div className="space-y-1 text-sm">
            {data.stockFantasma.items.map((i, idx) => (
              <p key={idx}>• {i.productoCodigo} — {i.productoNombre} — <strong>{String(i.stockSinLotes ?? '')}u</strong> sin lotes asociados</p>
            ))}
          </div>
        </Card>
      )}

      {totalAlertas === 0 && (
        <Card className="border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="font-semibold text-emerald-800">Sin alertas</p>
          <p className="text-sm text-emerald-700">No se detectaron lotes por vencer, stock en cuarentena, baja, ni stock fantasma.</p>
        </Card>
      )}
    </div>
  )
}
