import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Printer,
  Receipt,
  User,
  Calendar,
  Package,
  Tag,
} from 'lucide-react'
import type { CartItem } from '../types'
import { formatCurrency } from '@/lib/utils'

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  items: CartItem[]
  subtotal: number
  montoIgv: number
  total: number
  metodoPago: string
  montoEfectivo: number
  montoDigital: number
  vuelto: number
  clienteNombre: string
  isProcessing: boolean
  errors: string[]
}

export function CheckoutModal({
  isOpen,
  onClose,
  onConfirm,
  items,
  subtotal,
  montoIgv,
  total,
  metodoPago,
  montoEfectivo,
  montoDigital,
  vuelto,
  clienteNombre,
  isProcessing,
  errors,
}: CheckoutModalProps) {
  if (!isOpen) return null

  const totalPagado = montoEfectivo + montoDigital
  const isPagoCompleto = totalPagado >= total

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Confirmar Venta</h2>
              <p className="text-sm text-muted">Revisa los detalles antes de procesar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          {/* Errors */}
          {errors.length > 0 && (
            <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 mb-2">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Errores encontrados</span>
              </div>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Cliente Info */}
          <div className="mx-6 mt-4 p-4 bg-muted/30 rounded-lg">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted" />
                <div>
                  <p className="text-xs text-muted">Cliente</p>
                  <p className="font-medium text-foreground">{clienteNombre}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted" />
                <div>
                  <p className="text-xs text-muted">Fecha</p>
                  <p className="font-medium text-foreground">
                    {new Date().toLocaleDateString('es-PE')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Items List */}
          <div className="mx-6 mt-4">
            <h3 className="text-sm font-medium text-muted mb-2 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Productos ({items.length})
            </h3>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-muted font-medium">Producto</th>
                    <th className="px-3 py-2 text-center text-muted font-medium">Cant.</th>
                    <th className="px-3 py-2 text-right text-muted font-medium">P.U.</th>
                    <th className="px-3 py-2 text-right text-muted font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => {
                    const lotesConsumo: Array<{ lote: (typeof item.fefoLotes)[0]; consumir: number }> = []
                    if (item.fefoLotes.length > 0) {
                      let restante = item.cantidad
                      for (const lote of item.fefoLotes) {
                        if (restante <= 0) break
                        const consumir = Math.min(lote.cantidad, restante)
                        lotesConsumo.push({ lote, consumir })
                        restante -= consumir
                      }
                    }

                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{item.productoNombre}</p>
                          <p className="text-xs text-muted">{item.productoCodigo}</p>
                          {/* Trazabilidad FEFO */}
                          {lotesConsumo.length === 1 && (
                            <p className={`text-xs mt-0.5 flex items-center gap-1 ${
                              lotesConsumo[0].lote.alerta === 'CRITICO'
                                ? 'text-red-600'
                                : lotesConsumo[0].lote.alerta === 'PROXIMO'
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}>
                              <Tag className="h-3 w-3 shrink-0" />
                              {lotesConsumo[0].lote.codigoLote ?? 'Lote FEFO'}
                              {' · '}
                              Vence {lotesConsumo[0].lote.fechaVencimiento}
                            </p>
                          )}
                          {lotesConsumo.length > 1 && (
                            <p className="text-xs mt-0.5 text-violet-700 flex items-center gap-1">
                              <Tag className="h-3 w-3 shrink-0" />
                              Multi-lote FEFO:{' '}
                              {lotesConsumo
                                .map((lc) => `${lc.lote.codigoLote ?? '?'} (${lc.consumir}u)`)
                                .join(' + ')}
                            </p>
                          )}
                          {item.fefoLotes.length === 0 && (
                            <p className="text-xs mt-0.5 text-muted/50">Sin trazabilidad de lote</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className="font-medium">{item.cantidad}</span>
                          <span className="text-xs text-muted ml-1">u</span>
                        </td>
                        <td className="px-3 py-2 text-right text-muted">
                          {formatCurrency(item.precioUnitario)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totales */}
          <div className="mx-6 mt-4 rounded-lg overflow-hidden border border-border">
            {/* Encabezado tributario */}
            <div className="bg-muted/40 px-4 py-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Resumen tributario</p>
            </div>

            <div className="px-4 py-3 space-y-2 bg-muted/20">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Valor de venta (base imponible)</span>
                <span className="tabular-nums text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">IGV 18% (incluido en precio)</span>
                <span className="tabular-nums text-foreground">{formatCurrency(montoIgv)}</span>
              </div>
            </div>

            {/* Método y desglose de pago */}
            <div className="px-4 py-3 space-y-2 border-t border-border/60 bg-muted/10">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">Pago</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Método</span>
                <span className="font-medium text-foreground">{metodoPago}</span>
              </div>
              {montoEfectivo > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Efectivo entregado</span>
                  <span className="tabular-nums text-foreground">{formatCurrency(montoEfectivo)}</span>
                </div>
              )}
              {montoDigital > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Pago digital</span>
                  <span className="tabular-nums text-foreground">{formatCurrency(montoDigital)}</span>
                </div>
              )}
              {vuelto > 0 && (
                <div className="flex justify-between text-sm font-medium text-green-700">
                  <span>Vuelto al cliente</span>
                  <span className="tabular-nums">{formatCurrency(vuelto)}</span>
                </div>
              )}
            </div>

            {/* Total final */}
            <div className="flex justify-between items-center px-4 py-4 bg-primary/5 border-t border-primary/20">
              <div>
                <p className="text-lg font-bold text-foreground">TOTAL A COBRAR</p>
                <p className="text-xs text-muted">Precio final con IGV incluido</p>
              </div>
              <span className="text-3xl font-bold text-primary tabular-nums">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-surface">
          <div className="flex items-center gap-2">
            {isPagoCompleto ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Pago completo</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">
                  Falta: {formatCurrency(total - totalPagado)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-6 py-3 border border-border rounded-lg font-medium text-muted hover:bg-accent transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              disabled={isProcessing || !isPagoCompleto}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 transition-colors"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Printer className="h-5 w-5" />
                  Confirmar e Imprimir
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
