import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { SalesPOS } from '@/pos'
import { useAuth } from '@/context/auth-context'
import { apiGetSales, apiAnularVenta } from '@/lib/api'
import type { ApiSale } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Tab = 'pos' | 'historial'

function VentasHistorial() {
  const { isAdmin, isSuper } = useAuth()
  const puedeAnular = isAdmin || isSuper

  const [ventas, setVentas] = useState<ApiSale[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [anulando, setAnulando] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    apiGetSales()
      .then(setVentas)
      .catch(() => toast.error('Error al cargar ventas'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const iniciarAnulacion = (id: string) => {
    setConfirmId(id)
    setMotivo('')
  }

  const cancelarAnulacion = () => {
    setConfirmId(null)
    setMotivo('')
  }

  const confirmarAnulacion = async () => {
    if (!confirmId) return
    if (!motivo.trim()) {
      toast.error('Debe ingresar el motivo de anulación')
      return
    }
    setAnulando(true)
    try {
      const res = await apiAnularVenta(confirmId, motivo.trim())
      toast.success(res.message)
      cancelarAnulacion()
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al anular')
    } finally {
      setAnulando(false)
    }
  }

  if (loading) return <p className="p-6 text-muted">Cargando ventas...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{ventas.length} venta(s) registrada(s)</p>
        <Button variant="outline" size="sm" onClick={load}>Actualizar</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-muted">
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Fecha</th>
                {puedeAnular && <th className="px-4 py-3">Acción</th>}
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <>
                  <tr key={v.id} className={`border-b last:border-0 ${v.estado === 'C' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs">{v.codigo}</td>
                    <td className="px-4 py-3 max-w-[150px] truncate">{v.customer}</td>
                    <td className="px-4 py-3 text-center">{v.itemsCount}</td>
                    <td className="px-4 py-3">{v.paymentMethod}</td>
                    <td className="px-4 py-3 font-semibold">S/{v.total.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={v.estado === 'A' ? 'success' : 'danger'}>
                        {v.estado === 'A' ? 'Activa' : 'Anulada'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">{v.at}</td>
                    {puedeAnular && (
                      <td className="px-4 py-3">
                        {v.estado === 'A' && confirmId !== v.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => iniciarAnulacion(v.id)}
                          >
                            Anular
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                  {confirmId === v.id && (
                    <tr key={`${v.id}-confirm`} className="border-b bg-red-50">
                      <td colSpan={puedeAnular ? 8 : 7} className="px-4 py-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium text-red-700">
                            ¿Anular {v.codigo}?
                          </span>
                          <Input
                            className="h-8 w-64 text-sm"
                            placeholder="Motivo obligatorio..."
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && confirmarAnulacion()}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={confirmarAnulacion}
                            disabled={anulando || !motivo.trim()}
                          >
                            {anulando ? 'Anulando...' : 'Confirmar anulación'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelarAnulacion} disabled={anulando}>
                            Cancelar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {ventas.length === 0 && (
                <tr>
                  <td colSpan={puedeAnular ? 8 : 7} className="px-4 py-6 text-center text-muted">
                    Sin ventas registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function SalesPage() {
  const [tab, setTab] = useState<Tab>('pos')

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <button
          className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
            tab === 'pos'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted hover:text-foreground'
          }`}
          onClick={() => setTab('pos')}
        >
          Terminal POS
        </button>
        <button
          className={`px-4 py-1.5 text-sm font-medium rounded-t-md transition-colors ${
            tab === 'historial'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted hover:text-foreground'
          }`}
          onClick={() => setTab('historial')}
        >
          Historial de ventas
        </button>
      </div>

      {tab === 'pos' && <SalesPOS />}
      {tab === 'historial' && <VentasHistorial />}
    </div>
  )
}
