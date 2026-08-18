import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CreditCard, DollarSign, ArrowDownCircle, ArrowUpCircle, Receipt, XCircle } from 'lucide-react'
import {
  apiGetCaja,
  apiAbrirCaja,
  apiCerrarCaja,
  apiGetCajaMovimientos,
  apiAddCajaMovimiento,
  apiAnularCajaMovimiento,
  apiGetCajaResumen,
  apiGetUsuarios,
  type ApiCaja,
  type ApiCajaMovimiento,
  type ApiCajaResumen,
  type ApiUsuario,
  type CajaTipoMovimiento,
  type CajaMetodoPago,
} from '@/lib/api'
import { useAuth } from '@/context/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const TIPOS_MOV: { tipo: CajaTipoMovimiento; label: string }[] = [
  { tipo: 'INGRESO', label: 'Ingreso extra' },
  { tipo: 'EGRESO', label: 'Egreso' },
  { tipo: 'GASTO', label: 'Gasto' },
  { tipo: 'PAGO_FACTURA', label: 'Pago a factura' },
]

const METODOS: CajaMetodoPago[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE', 'PLIN', 'OTRO']

type MovimientoFormState = {
  tipo: CajaTipoMovimiento
  monto: string
  metodoPago: CajaMetodoPago
  descripcion: string
}

const EMPTY_MOV_FORM: MovimientoFormState = {
  tipo: 'EGRESO',
  monto: '',
  metodoPago: 'EFECTIVO',
  descripcion: '',
}

export function CajaPage() {
  const { isAdmin, isSuper } = useAuth()
  const puedeAdministrarCaja = isAdmin || isSuper
  const [data, setData] = useState<ApiCaja | null>(null)
  const [movimientos, setMovimientos] = useState<ApiCajaMovimiento[]>([])
  const [resumen, setResumen] = useState<ApiCajaResumen | null>(null)
  const [usuarios, setUsuarios] = useState<ApiUsuario[]>([])
  const [loading, setLoading] = useState(true)
  const [montoApertura, setMontoApertura] = useState('')
  const [usuarioAsignadoId, setUsuarioAsignadoId] = useState('')
  const [cajaSeleccionadaId, setCajaSeleccionadaId] = useState('')
  const [movForm, setMovForm] = useState<MovimientoFormState>(EMPTY_MOV_FORM)
  const [movSubmitting, setMovSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cajaResp = await apiGetCaja()
      setData(cajaResp)

      const cajas = cajaResp.cajasAbiertas ?? (cajaResp.cajaAbierta ? [cajaResp.cajaAbierta] : [])
      const cajaActualId = cajaSeleccionadaId && cajas.some((caja) => caja.nid === cajaSeleccionadaId)
        ? cajaSeleccionadaId
        : cajaResp.cajaAbierta?.nid ?? (puedeAdministrarCaja ? cajas[0]?.nid : '')

      if (cajaActualId !== cajaSeleccionadaId) {
        setCajaSeleccionadaId(cajaActualId || '')
      }

      if (!cajaActualId) {
        setMovimientos([])
        setResumen({ abierta: false })
        return
      }

      const [movResp, resumenResp] = await Promise.allSettled([
        apiGetCajaMovimientos({ cajaId: cajaActualId }),
        apiGetCajaResumen({ cajaId: cajaActualId }),
      ])
      if (movResp.status === 'fulfilled') setMovimientos(movResp.value)
      else setMovimientos([])
      if (resumenResp.status === 'fulfilled') setResumen(resumenResp.value)
      else setResumen({ abierta: false })
    } catch {
      toast.error('Error al cargar caja')
      setData(null)
      setMovimientos([])
      setResumen({ abierta: false })
    } finally {
      setLoading(false)
    }
  }, [cajaSeleccionadaId, puedeAdministrarCaja])

  useEffect(() => {
    if (!puedeAdministrarCaja) {
      setUsuarios([])
      return
    }
    apiGetUsuarios()
      .then((rows) => setUsuarios(rows.filter((u) => u.estado === 'A')))
      .catch(() => setUsuarios([]))
  }, [puedeAdministrarCaja])

  useEffect(() => { load() }, [load])

  const abrir = async () => {
    if (!usuarioAsignadoId) {
      toast.error('Seleccione el usuario/cajero asignado')
      return
    }
    try {
      await apiAbrirCaja(
        parseFloat(montoApertura) || 0,
        undefined,
        Number(usuarioAsignadoId),
      )
      toast.success('Caja abierta')
      setMontoApertura('')
      setUsuarioAsignadoId('')
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const cerrar = async () => {
    if (!puedeAdministrarCaja) {
      toast.error('Solo administrador puede cerrar caja')
      return
    }
    if (!cajaSeleccionadaId) {
      toast.error('Seleccione caja a cerrar')
      return
    }
    try {
      const res = await apiCerrarCaja(Number(cajaSeleccionadaId))
      const montoCierre = res.resumen?.montoCierre ?? res.resumen?.saldoEsperado
      toast.success(
        montoCierre === undefined
          ? 'Caja cerrada'
          : `Caja cerrada automáticamente: S/${montoCierre.toFixed(2)}`,
      )
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const submitMovimiento = async () => {
    const monto = parseFloat(movForm.monto)
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('Debe ingresar un monto válido')
      return
    }
    if (!movForm.descripcion.trim()) {
      toast.error('Debe ingresar una descripción')
      return
    }
    setMovSubmitting(true)
    try {
      await apiAddCajaMovimiento({
        tipo: movForm.tipo,
        monto,
        metodoPago: movForm.metodoPago,
        descripcion: movForm.descripcion.trim(),
      })
      toast.success('Movimiento registrado')
      setMovForm(EMPTY_MOV_FORM)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error registrando movimiento')
    } finally {
      setMovSubmitting(false)
    }
  }

  const anularMovimiento = async (movimiento: ApiCajaMovimiento) => {
    const motivo = window.prompt('Motivo de anulación')
    if (!motivo?.trim()) return
    try {
      await apiAnularCajaMovimiento(movimiento.nid, motivo.trim())
      toast.success('Movimiento anulado')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error anulando movimiento')
    }
  }

  const movResumen = useMemo(() => {
    const out: Record<string, number> = { INGRESO: 0, EGRESO: 0, GASTO: 0, PAGO_FACTURA: 0 }
    for (const m of movimientos) {
      out[m.tipo] = (out[m.tipo] || 0) + m.monto
    }
    return out
  }, [movimientos])

  if (loading) return <p className="p-6 text-muted">Cargando...</p>

  const cajaAbierta = Boolean(data?.cajaAbierta)
  const cajasAbiertas = data?.cajasAbiertas ?? (data?.cajaAbierta ? [data.cajaAbierta] : [])
  const cajaSeleccionada = cajasAbiertas.find((caja) => caja.nid === cajaSeleccionadaId) ?? data?.cajaAbierta ?? null
  const saldoEsperado = resumen?.saldoEsperado ?? resumen?.saldoTeorico ?? 0
  const estadoCajaLabel = cajaAbierta
    ? 'Abierta'
    : puedeAdministrarCaja && cajasAbiertas.length > 0
      ? `${cajasAbiertas.length} abierta(s)`
      : 'Cerrada'

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted">Estado</p>
              <p className="text-lg font-bold">{estadoCajaLabel}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted">Ventas hoy</p>
              <p className="text-lg font-bold">S/{data?.ventasHoy.total.toFixed(2) ?? '0.00'} ({data?.ventasHoy.cantidad ?? 0})</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ArrowUpCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted">Ingresos extra</p>
              <p className="text-lg font-bold">S/{movResumen.INGRESO.toFixed(2)}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
              <ArrowDownCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted">Egresos / Pagos / Gastos</p>
              <p className="text-lg font-bold">
                S/{(movResumen.EGRESO + movResumen.GASTO + movResumen.PAGO_FACTURA).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {resumen?.abierta && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-muted">Saldo esperado</p>
              <p className="text-2xl font-bold">S/{saldoEsperado.toFixed(2)}</p>
              <p className="text-xs text-muted">
                Apertura S/{(resumen.apertura ?? 0).toFixed(2)} + Ventas S/{(resumen.ventas ?? 0).toFixed(2)} + Ingresos S/{(resumen.ingresos ?? 0).toFixed(2)} − Egresos/Gastos/Pagos S/{(resumen.egresos ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 text-sm">
          <p className="text-muted">Desglose de ventas por método</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {data?.desglose && Object.entries(data.desglose).map(([k, v]) => (
              <Badge key={k} variant="neutral">{k}: S/{v.toFixed(2)}</Badge>
            ))}
            {!data?.desglose || Object.keys(data?.desglose || {}).length === 0
              ? <span className="text-muted">Sin ventas registradas hoy</span>
              : null}
          </div>
        </Card>
        <Card className="p-5 text-sm sm:col-span-2">
          <p className="text-muted">Tendencia de movimientos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="neutral">Ventas: S/{(resumen?.ventas ?? 0).toFixed(2)}</Badge>
            <Badge variant="neutral">Ingresos: S/{movResumen.INGRESO.toFixed(2)}</Badge>
            <Badge variant="neutral">Egresos: S/{movResumen.EGRESO.toFixed(2)}</Badge>
            <Badge variant="neutral">Gastos: S/{movResumen.GASTO.toFixed(2)}</Badge>
            <Badge variant="neutral">Pagos a facturas: S/{movResumen.PAGO_FACTURA.toFixed(2)}</Badge>
          </div>
        </Card>
      </div>

      {puedeAdministrarCaja && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Abrir caja</h3>
          <div className="flex gap-3 items-end">
            <label className="block space-y-1 flex-1">
              <span className="text-sm">Monto de apertura (S/)</span>
              <Input type="number" value={montoApertura} onChange={e => setMontoApertura(e.target.value)} placeholder="0.00" />
            </label>
            <label className="block space-y-1 flex-1">
              <span className="text-sm">Usuario asignado</span>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={usuarioAsignadoId}
                onChange={e => setUsuarioAsignadoId(e.target.value)}
              >
                <option value="">Seleccione usuario/cajero</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>
                ))}
              </select>
            </label>
            <Button onClick={abrir}>Abrir caja</Button>
          </div>
        </Card>
      )}

      {!cajaAbierta && !puedeAdministrarCaja && (
        <Card className="p-6">
          <h3 className="font-semibold mb-1">Sin caja asignada</h3>
          <p className="text-sm text-muted">
            Un administrador debe abrir una caja y asignarla a su usuario antes de vender.
          </p>
        </Card>
      )}

      {cajasAbiertas.length > 0 && (
        <Card className="p-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h3 className="font-semibold">Cajas abiertas</h3>
            {puedeAdministrarCaja && (
              <label className="block space-y-1">
                <span className="text-xs text-muted">Caja para resumen/cierre</span>
                <select
                  className="w-72 rounded-lg border px-3 py-2 text-sm"
                  value={cajaSeleccionadaId}
                  onChange={(e) => setCajaSeleccionadaId(e.target.value)}
                >
                  {cajasAbiertas.map((caja) => (
                    <option key={caja.nid} value={caja.nid}>
                      {caja.ccaja} — {caja.usuarioNombre || caja.usuarioId || '-'}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted">
                  <th className="pb-2">Caja</th>
                  <th className="pb-2">Usuario asignado</th>
                  <th className="pb-2">Apertura</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {cajasAbiertas.map((caja) => (
                  <tr key={caja.nid} className={`border-b last:border-0 ${caja.nid === cajaSeleccionadaId ? 'bg-primary/5' : ''}`}>
                    <td className="py-2">{caja.ccaja}</td>
                    <td>{caja.usuarioNombre || caja.usuarioId || '-'}</td>
                    <td>S/{caja.napertura}</td>
                    <td className="text-muted">{caja.tapertura}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {cajaAbierta && (
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Caja abierta</h3>
            <p className="text-sm text-muted">
              Apertura: S/{data?.cajaAbierta?.napertura} — {data?.cajaAbierta?.tapertura}
              {data?.cajaAbierta?.usuarioId ? ` — Usuario asignado: ${data.cajaAbierta.usuarioNombre || data.cajaAbierta.usuarioId}` : ''}
            </p>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-sm font-semibold">Nuevo movimiento</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block space-y-1">
                <span className="text-xs text-muted">Tipo *</span>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={movForm.tipo}
                  onChange={e => setMovForm({ ...movForm, tipo: e.target.value as CajaTipoMovimiento })}
                >
                  {TIPOS_MOV.map((t) => (
                    <option key={t.tipo} value={t.tipo}>{t.label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Monto (S/) *</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={movForm.monto}
                  onChange={e => setMovForm({ ...movForm, monto: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">Método *</span>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={movForm.metodoPago}
                  onChange={e => setMovForm({ ...movForm, metodoPago: e.target.value as CajaMetodoPago })}
                >
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label className="block space-y-1 sm:col-span-1">
                <span className="text-xs text-muted">Descripción *</span>
                <Input
                  value={movForm.descripcion}
                  onChange={e => setMovForm({ ...movForm, descripcion: e.target.value })}
                  placeholder="Ej: pago de luz"
                />
              </label>
            </div>
            <div className="flex justify-end">
              <Button onClick={submitMovimiento} disabled={movSubmitting}>
                {movSubmitting ? 'Registrando...' : 'Registrar movimiento'}
              </Button>
            </div>
            <p className="text-xs text-muted">
              Los movimientos PAGO_FACTURA también se pueden generar al aplicar pagos en Cuentas por pagar.
            </p>
          </div>

          {!puedeAdministrarCaja && (
            <p className="text-xs text-muted">
              Cierre reservado para administrador. Usted puede vender y registrar movimientos permitidos.
            </p>
          )}
        </Card>
      )}

      {puedeAdministrarCaja && cajaSeleccionada && resumen?.abierta && (
        <Card className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-1">Cerrar caja</h3>
            <p className="text-sm text-muted">
              {cajaSeleccionada.ccaja} — {cajaSeleccionada.usuarioNombre || cajaSeleccionada.usuarioId || '-'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            <Badge variant="neutral">Apertura: S/{(resumen.apertura ?? 0).toFixed(2)}</Badge>
            <Badge variant="success">Ventas: S/{(resumen.ventas ?? 0).toFixed(2)}</Badge>
            <Badge variant="success">Ingresos: S/{(resumen.ingresos ?? 0).toFixed(2)}</Badge>
            <Badge variant="warning">Egresos: S/{(resumen.egresos ?? 0).toFixed(2)}</Badge>
            <Badge variant="neutral">Esperado: S/{saldoEsperado.toFixed(2)}</Badge>
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-52 rounded-lg border px-3 py-2 text-sm">
              <p className="text-xs text-muted">Cierre automático</p>
              <p className="font-semibold">S/{saldoEsperado.toFixed(2)}</p>
            </div>
            <div className="min-w-44 rounded-lg border px-3 py-2 text-sm">
              <p className="text-xs text-muted">Diferencia</p>
              <p className="font-semibold">S/0.00</p>
            </div>
            <Button variant="outline" onClick={cerrar}>Cerrar caja automática</Button>
          </div>
        </Card>
      )}

      {movimientos.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Movimientos de la caja actual</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted">
                  <th className="pb-2">Fecha</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Método</th>
                  <th className="pb-2">Monto</th>
                  <th className="pb-2">Descripción</th>
                  <th className="pb-2">Usuario</th>
                  <th className="pb-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr key={m.nid} className="border-b last:border-0">
                    <td className="py-2 text-muted">{m.fecha}</td>
                    <td>
                      <Badge
                        variant={
                          m.tipo === 'INGRESO' ? 'success'
                          : m.tipo === 'EGRESO' || m.tipo === 'GASTO' ? 'warning'
                          : m.tipo === 'PAGO_FACTURA' ? 'neutral'
                          : 'neutral'
                        }
                      >
                        {m.tipo}
                      </Badge>
                    </td>
                    <td>{m.metodoPago}</td>
                    <td className="font-semibold">S/{m.monto.toFixed(2)}</td>
                    <td>{m.descripcion}</td>
                    <td className="text-muted">{m.usuario}</td>
                    <td className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => anularMovimiento(m)}
                        title="Anular movimiento"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data?.historial && data.historial.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-3">Historial de cajas</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted">
                  <th className="pb-2">Caja</th>
                  <th className="pb-2">Usuario</th>
                  <th className="pb-2">Apertura</th>
                  <th className="pb-2">Cierre</th>
                  <th className="pb-2">Esperado</th>
                  <th className="pb-2">Diferencia</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {data.historial.map((h, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{h.ccaja.trim()}</td>
                    <td>{h.cnombre.trim()}</td>
                    <td>S/{h.napertura}</td>
                    <td>{h.ncierre ? `S/${String(h.ncierre)}` : '-'}</td>
                    <td>{h.cestado === 'C' ? `S/${h.saldoEsperado.toFixed(2)}` : '-'}</td>
                    <td className={h.diferencia === 0 ? '' : 'font-semibold text-rose-700'}>
                      {h.cestado === 'C' ? `S/${h.diferencia.toFixed(2)}` : '-'}
                    </td>
                    <td><Badge variant={h.cestado === 'A' ? 'success' : 'neutral'}>{h.cestado === 'A' ? 'Abierta' : 'Cerrada'}</Badge></td>
                    <td>{h.tapertura}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
