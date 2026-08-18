import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  apiGetCxp,
  apiGetCxpResumen,
  apiPagarCxp,
  type ApiCxp,
  type ApiCxpResumen,
  type CajaMetodoPago,
} from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const METODOS: CajaMetodoPago[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE', 'PLIN', 'OTRO']
const ESTADOS_FILTRO = ['TODAS', 'PENDIENTE', 'PARCIAL', 'PAGADA'] as const
type EstadoFiltro = (typeof ESTADOS_FILTRO)[number]

type PagoState = {
  cxpId: string
  monto: string
  metodoPago: CajaMetodoPago
  documento: string
  notas: string
}

const EMPTY_PAGO: PagoState = {
  cxpId: '',
  monto: '',
  metodoPago: 'EFECTIVO',
  documento: '',
  notas: '',
}

function estadoVariant(estado: string): 'success' | 'warning' | 'neutral' {
  if (estado === 'PAGADA') return 'success'
  if (estado === 'PENDIENTE' || estado === 'PARCIAL') return 'warning'
  return 'neutral'
}

export function CxpPage() {
  const [items, setItems] = useState<ApiCxp[]>([])
  const [resumen, setResumen] = useState<ApiCxpResumen[]>([])
  const [estado, setEstado] = useState<EstadoFiltro>('PENDIENTE')
  const [soloVencidas, setSoloVencidas] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pago, setPago] = useState<PagoState>(EMPTY_PAGO)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cxpResp, resumenResp] = await Promise.allSettled([
        apiGetCxp({
          estado: estado === 'TODAS' ? undefined : estado,
          vencidas: soloVencidas,
        }),
        apiGetCxpResumen(),
      ])
      if (cxpResp.status === 'fulfilled') setItems(cxpResp.value)
      else toast.error('Error al cargar cuentas por pagar')
      if (resumenResp.status === 'fulfilled') setResumen(resumenResp.value)
    } finally {
      setLoading(false)
    }
  }, [estado, soloVencidas])

  useEffect(() => { load() }, [load])

  const cxpSeleccionada = useMemo(
    () => items.find((it) => it.nid === pago.cxpId) ?? null,
    [items, pago.cxpId],
  )

  const startPago = (cxp: ApiCxp) => {
    setPago({
      cxpId: cxp.nid,
      monto: String(cxp.saldo.toFixed(2)),
      metodoPago: 'EFECTIVO',
      documento: '',
      notas: '',
    })
  }

  const submitPago = async () => {
    const monto = parseFloat(pago.monto)
    if (!cxpSeleccionada) {
      toast.error('Seleccione una cuenta por pagar')
      return
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Monto inválido')
      return
    }
    if (monto > cxpSeleccionada.saldo + 0.005) {
      toast.error(`El monto excede el saldo (S/${cxpSeleccionada.saldo.toFixed(2)})`)
      return
    }
    setSubmitting(true)
    try {
      await apiPagarCxp(pago.cxpId, {
        monto,
        metodoPago: pago.metodoPago,
        documento: pago.documento.trim() || undefined,
        notas: pago.notas.trim() || undefined,
      })
      toast.success('Pago registrado')
      setPago(EMPTY_PAGO)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error registrando pago')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  const totalPendiente = resumen.reduce((acc, r) => acc + r.saldoTotal, 0)
  const totalVencido = resumen.reduce((acc, r) => acc + r.vencido, 0)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Saldo total por pagar</p>
          <p className="text-2xl font-bold">S/{totalPendiente.toFixed(2)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Vencido</p>
          <p className="text-2xl font-bold text-rose-700">S/{totalVencido.toFixed(2)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Proveedores con saldo</p>
          <p className="text-2xl font-bold">{resumen.length}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Saldos por proveedor</h3>
        {resumen.length === 0 ? (
          <p className="text-sm text-muted">No hay saldos pendientes</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {resumen.map((r) => (
              <Badge key={r.proveedorId} variant={r.vencido > 0 ? 'warning' : 'neutral'}>
                {r.proveedorNombre || `Proveedor ${r.proveedorId}`}: S/{r.saldoTotal.toFixed(2)}
                {r.vencido > 0 ? ` (vencido S/${r.vencido.toFixed(2)})` : ''}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="space-y-1">
            <span className="text-xs text-muted">Estado</span>
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoFiltro)}
            >
              {ESTADOS_FILTRO.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm pb-1">
            <input
              type="checkbox"
              checked={soloVencidas}
              onChange={(e) => setSoloVencidas(e.target.checked)}
            />
            Solo vencidas
          </label>
          <Button variant="outline" onClick={load}>Actualizar</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted">
                <th className="pb-2">Compra</th>
                <th className="pb-2">Proveedor</th>
                <th className="pb-2">Emisión</th>
                <th className="pb-2">Vencimiento</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Pagado</th>
                <th className="pb-2">Saldo</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.nid} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{it.compraCodigo || `#${it.compraId}`}</td>
                  <td>{it.proveedorNombre || `Proveedor ${it.proveedorId}`}</td>
                  <td className="text-muted">{it.fechaEmision}</td>
                  <td className={it.diasAtraso && it.diasAtraso > 0 ? 'text-rose-700' : ''}>
                    {it.fechaVencimiento || '-'}
                    {it.diasAtraso && it.diasAtraso > 0 ? <span className="ml-1 text-xs">({it.diasAtraso}d)</span> : null}
                  </td>
                  <td>S/{it.montoTotal.toFixed(2)}</td>
                  <td>S/{it.montoPagado.toFixed(2)}</td>
                  <td className="font-semibold">S/{it.saldo.toFixed(2)}</td>
                  <td><Badge variant={estadoVariant(it.estado)}>{it.estado}</Badge></td>
                  <td>
                    {it.saldo > 0 ? (
                      <Button size="sm" variant="outline" onClick={() => startPago(it)}>
                        Pagar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-4 text-center text-muted">
                    No hay cuentas por pagar con los filtros actuales
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {cxpSeleccionada && (
        <Card className="p-5 space-y-3">
          <h3 className="text-sm font-semibold">
            Registrar pago — {cxpSeleccionada.compraCodigo || `#${cxpSeleccionada.compraId}`} ({cxpSeleccionada.proveedorNombre})
          </h3>
          <p className="text-xs text-muted">
            Saldo actual: S/{cxpSeleccionada.saldo.toFixed(2)} · Pagado previo: S/{cxpSeleccionada.montoPagado.toFixed(2)}
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="block space-y-1">
              <span className="text-xs text-muted">Monto *</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={pago.monto}
                onChange={(e) => setPago({ ...pago, monto: e.target.value })}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Método *</span>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={pago.metodoPago}
                onChange={(e) => setPago({ ...pago, metodoPago: e.target.value as CajaMetodoPago })}
              >
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Documento</span>
              <Input value={pago.documento} onChange={(e) => setPago({ ...pago, documento: e.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs text-muted">Notas</span>
              <Input value={pago.notas} onChange={(e) => setPago({ ...pago, notas: e.target.value })} />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPago(EMPTY_PAGO)}>Cancelar</Button>
            <Button onClick={submitPago} disabled={submitting}>
              {submitting ? 'Registrando...' : 'Registrar pago'}
            </Button>
          </div>
          <p className="text-xs text-muted">
            El pago genera un movimiento de tipo PAGO_FACTURA en la caja abierta y descuenta el saldo de la cuenta.
          </p>
        </Card>
      )}
    </div>
  )
}
