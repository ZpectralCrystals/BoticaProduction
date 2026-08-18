import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  AlertTriangle,
  Clock,
  Receipt,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { CartItem } from '../types'
import { formatCurrency } from '@/lib/utils'

interface CartProps {
  items: CartItem[]
  subtotal: number
  montoIgv: number
  total: number
  onUpdateQuantity: (itemId: string, cantidad: number) => void
  onUpdatePrice: (itemId: string, priceKey: CartItem['precioSeleccionado']) => void
  onRemoveItem: (itemId: string) => void
  onClearCart: () => void
  onCheckout: () => void
}

export function Cart({ 
  items, 
  subtotal, 
  montoIgv, 
  total, 
  onUpdateQuantity, 
  onUpdatePrice,
  onRemoveItem, 
  onClearCart,
  onCheckout 
}: CartProps) {
  const itemCount = items.length
  const totalUnidades = items.reduce((sum, item) => sum + item.cantidad, 0)
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({})

  const getMaxQuantity = (item: CartItem) => (
    item.fefoLotes.length > 0
      ? item.fefoLotes.reduce((sum, lote) => sum + lote.cantidad, 0)
      : item.stock
  )

  const setQuantity = (item: CartItem, rawQuantity: number) => {
    const maxQuantity = Math.max(1, getMaxQuantity(item))
    const nextQuantity = Math.max(1, Math.min(rawQuantity, maxQuantity))
    setQuantityDrafts((current) => ({ ...current, [item.id]: String(nextQuantity) }))
    onUpdateQuantity(item.id, nextQuantity)
  }

  const handleQuantityInput = (item: CartItem, value: string) => {
    const digitsOnly = value.replace(/\D/g, '')
    setQuantityDrafts((current) => ({ ...current, [item.id]: digitsOnly }))
    if (digitsOnly === '') return
    setQuantity(item, Number(digitsOnly))
  }

  const commitQuantityInput = (item: CartItem) => {
    const draft = quantityDrafts[item.id]
    if (!draft) {
      setQuantityDrafts((current) => ({ ...current, [item.id]: String(item.cantidad) }))
      return
    }
    setQuantity(item, Number(draft))
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[18rem] flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
          <ShoppingCart className="h-8 w-8 text-muted" />
        </div>
        <p className="text-muted font-medium">Carrito vacío</p>
        <p className="text-sm text-muted/70 mt-1">
          Busca productos y agrégalos a la venta
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-md">
            <ShoppingCart className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Carrito</h3>
            <p className="text-xs text-muted">
              {itemCount} producto{itemCount !== 1 ? 's' : ''} • {totalUnidades} unidades
            </p>
          </div>
        </div>
        <button
          onClick={onClearCart}
          className="h-8 w-8 text-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors flex items-center justify-center"
          title="Vaciar carrito"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Lista de items */}
      <div className="max-h-[22rem] overflow-auto p-2 space-y-1">
        {items.map((item) => {
          return (
            <div
              key={item.id}
              className="bg-surface border border-border rounded-md px-2 py-1 shadow-sm md:min-h-[42px]"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1 md:grid-cols-[minmax(120px,1.1fr)_minmax(0,0.8fr)_100px_minmax(176px,190px)_90px_28px] md:items-center">
                <div className="min-w-0">
                  <p className="font-medium text-sm leading-tight text-foreground truncate">
                    {item.productoNombre}
                  </p>
                  <p className="text-xs text-muted leading-tight truncate">
                    {item.productoCodigo} · Stock {getMaxQuantity(item)}
                  </p>
                </div>

                <div className="col-span-2 flex min-w-0 flex-wrap gap-1 md:col-span-1 md:h-6 md:flex-nowrap md:items-center md:overflow-hidden">
                  {item.alertas.map((alerta, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${
                        alerta.severidad === 'CRITICA'
                          ? 'bg-red-100 text-red-700'
                          : alerta.severidad === 'ALTA'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {alerta.tipo === 'VENCIMIENTO' && <Clock className="h-3 w-3" />}
                      {alerta.tipo === 'RECETA' && <AlertTriangle className="h-3 w-3" />}
                      {alerta.mensaje}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-0.5">
                  <button
                    onClick={() => setQuantity(item, item.cantidad - 1)}
                    className="h-6 w-6 rounded-md hover:bg-accent transition-colors flex items-center justify-center"
                    aria-label={`Restar ${item.productoNombre}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    aria-label={`Cantidad de ${item.productoNombre}`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantityDrafts[item.id] ?? String(item.cantidad)}
                    onChange={(event) => handleQuantityInput(item, event.target.value)}
                    onBlur={() => commitQuantityInput(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitQuantityInput(item)
                        event.currentTarget.blur()
                      }
                    }}
                    className="h-6 w-11 rounded-md border border-border bg-background px-1 text-center text-sm font-semibold text-foreground"
                  />
                  <button
                    onClick={() => setQuantity(item, item.cantidad + 1)}
                    className="h-6 w-6 rounded-md hover:bg-accent transition-colors flex items-center justify-center"
                    aria-label={`Sumar ${item.productoNombre}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="min-w-0 text-right">
                  {item.preciosVenta.length > 1 ? (
                    <select
                      className="h-7 w-full min-w-[176px] rounded-md border border-border bg-background px-2 pr-6 text-left text-xs font-medium text-foreground"
                      value={item.precioSeleccionado}
                      onChange={(e) => onUpdatePrice(item.id, e.target.value as CartItem['precioSeleccionado'])}
                    >
                      {item.preciosVenta.map((price) => (
                        <option key={price.key} value={price.key}>
                          {price.label} · {formatCurrency(price.value)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-muted leading-tight">
                      {item.preciosVenta[0]?.label ?? 'Precio'}
                    </p>
                  )}
                  {item.preciosVenta.length <= 1 && (
                    <p className="text-xs leading-tight text-muted">{formatCurrency(item.precioUnitario)}</p>
                  )}
                </div>

                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-semibold leading-tight text-foreground tabular-nums">
                    {formatCurrency(item.total)}
                  </p>
                </div>

                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="h-6 w-6 shrink-0 rounded text-muted hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center"
                  aria-label={`Quitar ${item.productoNombre}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Totales */}
      <div className="border-t border-border bg-surface p-3 space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Resumen tributario</p>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Valor de venta (base imponible)</span>
          <span className="text-foreground">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">IGV 18% (incluido en precio)</span>
          <span className="text-foreground">{formatCurrency(montoIgv)}</span>
        </div>
        <div className="border-t border-border pt-3">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-base font-semibold text-foreground">Total a cobrar</span>
              <p className="text-xs text-muted">Precio final con IGV incluido</p>
            </div>
            <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Botón pagar */}
        <button
          onClick={onCheckout}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-base hover:bg-primary/90 flex items-center justify-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <Receipt className="h-5 w-5" />
          Proceder al pago (F4)
        </button>
      </div>
    </div>
  )
}
