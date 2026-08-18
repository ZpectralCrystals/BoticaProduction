import { useState, useCallback, useMemo, useEffect } from 'react'
import { apiPOSCrearVenta, apiGetLotesDisponibles, apiGetPatients, apiGetAlmacenes, type ApiPOSProduct, type ApiPOSSaleItem, type ApiAlmacen } from '@/lib/api'
import type { CartItem, CustomerMode, LoteFefo, MetodoPago, PosPatientOption, SalePriceOption } from '../types'
import { calcularTotales, calcularVuelto, generarIdUnico, diasHastaVencimiento } from '../utils/posUtils'

interface ClienteData {
  nombre: string
  documento: string
  clinicalCustomerId: number | null
}

function getAvailableSalePrices(product: ApiPOSProduct): SalePriceOption[] {
  const values: SalePriceOption[] = [
    { key: 'precioVenta1', label: 'Precio 1', value: product.precioVenta1 ?? product.precioVenta ?? 0 },
    { key: 'precioVenta2', label: 'Precio 2', value: product.precioVenta2 ?? 0 },
    { key: 'precioVenta3', label: 'Precio 3', value: product.precioVenta3 ?? 0 },
  ]

  return values.filter((price) => Number.isFinite(price.value) && price.value > 0)
}

export function usePOS() {
  const [items, setItems] = useState<CartItem[]>([])
  const [patients, setPatients] = useState<PosPatientOption[]>([])
  const [almacenes, setAlmacenes] = useState<ApiAlmacen[]>([])
  const [almacenId, setAlmacenId] = useState<number | null>(null)
  const [customerMode, setCustomerMode] = useState<CustomerMode>('generico')
  const [clienteData, setClienteData] = useState<ClienteData>({
    nombre: 'Consumidor final',
    documento: '99999999',
    clinicalCustomerId: null,
  })
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo')
  const [montoEfectivo, setMontoEfectivo] = useState(0)
  const [montoDigital, setMontoDigital] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [lastVenta, setLastVenta] = useState<{ id: string; codigo: string } | null>(null)

  const totals = useMemo(() => calcularTotales(items), [items])

  useEffect(() => {
    apiGetPatients()
      .then((rows) =>
        setPatients(
          rows.map((row) => ({
            id: Number(row.id),
            fullName: row.fullName,
            documentId: row.documentId,
          })),
        ),
      )
      .catch(() => setPatients([]))
    apiGetAlmacenes()
      .then((list) => {
        const vendibles = list.filter((a) => a.permiteVenta)
        setAlmacenes(vendibles)
        if (vendibles.length > 0 && !almacenId) {
          setAlmacenId(vendibles[0].id)
        }
      })
      .catch(() => setAlmacenes([]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vuelto = useMemo(
    () => calcularVuelto(totals.total, montoEfectivo, montoDigital),
    [totals.total, montoEfectivo, montoDigital],
  )

  const addItem = useCallback(async (product: ApiPOSProduct) => {
    // Obtener lotes FEFO disponibles (falla silenciosa — sin lotes sigue funcionando)
    let fefoLote: LoteFefo | null = null
    let fefoLotes: LoteFefo[] = []
    try {
      const qs = almacenId ? `?soloVendible=true&almacenId=${almacenId}` : '?soloVendible=true'
      const res = await apiGetLotesDisponibles(product.id, qs)
      if (res.success && res.data.tieneLottes && res.data.lotes.length > 0) {
        fefoLotes = res.data.lotes.map((l) => ({
          id: l.id,
          codigoLote: l.codigoLote,
          fechaVencimiento: l.fechaVencimiento,
          cantidad: l.cantidad,
          diasParaVencer: l.diasParaVencer,
          alerta: l.alerta,
          stockAcumulado: l.stockAcumulado,
        }))
        fefoLote = fefoLotes[0]
      }
    } catch {
      // Sin lotes: comportamiento anterior
    }

    setItems((current) => {
      const preciosVenta = getAvailableSalePrices(product)
      if (preciosVenta.length === 0) return current
      const existing = current.find((i) => i.productoId === product.id)
      if (existing) {
        const next = existing.cantidad + 1
        const maxStock =
          existing.fefoLotes.length > 0
            ? existing.fefoLotes.reduce((s, l) => s + l.cantidad, 0)
            : existing.stock
        if (next > maxStock) return current
        return current.map((i) =>
          i.id === existing.id
            ? { ...i, cantidad: next, total: Math.round(next * i.precioUnitario * 100) / 100 }
            : i,
        )
      }

      if (product.stock <= 0) return current

      const dias = diasHastaVencimiento(
        fefoLote ? fefoLote.fechaVencimiento : product.expiresAt,
      )
      const alertas: CartItem['alertas'] = []
      if (dias !== null && dias <= 30) {
        alertas.push({
          tipo: 'VENCIMIENTO',
          severidad: dias <= 0 ? 'CRITICA' : dias <= 7 ? 'ALTA' : 'MEDIA',
          mensaje: dias <= 0 ? 'VENCIDO' : `Lote vence en ${dias} días`,
        })
      }
      if (product.stock <= 5) {
        alertas.push({
          tipo: 'STOCK_BAJO',
          severidad: product.stock <= 2 ? 'ALTA' : 'MEDIA',
          mensaje: `Stock bajo: ${product.stock} unidades`,
        })
      }
      if (product.receta === 'S') {
        alertas.push({ tipo: 'RECETA', severidad: 'MEDIA', mensaje: 'Requiere receta médica' })
      }

      const newItem: CartItem = {
        id: generarIdUnico(),
        productoId: product.id,
        productoCodigo: product.codigo,
        productoNombre: product.nombre,
        categoria: product.categoria,
        stock: product.stock,
        expiresAt: product.expiresAt,
        cantidad: 1,
        precioUnitario: preciosVenta[0].value,
        precioSeleccionado: preciosVenta[0].key,
        preciosVenta,
        total: preciosVenta[0].value,
        receta: product.receta === 'S' ? 'S' : 'N',
        alertas,
        fefoLote,
        fefoLotes,
      }
      return [...current, newItem]
    })
  }, [almacenId])

  const updateQuantity = useCallback((itemId: string, cantidad: number) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item
        const maxStock =
          item.fefoLotes.length > 0
            ? item.fefoLotes.reduce((s, l) => s + l.cantidad, 0)
            : item.stock
        const next = Math.max(1, Math.min(cantidad, maxStock))
        return { ...item, cantidad: next, total: Math.round(next * item.precioUnitario * 100) / 100 }
      }),
    )
  }, [])

  const updatePrice = useCallback((itemId: string, priceKey: SalePriceOption['key']) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item
        const nextPrice = item.preciosVenta.find((price) => price.key === priceKey)
        if (!nextPrice) return item
        return {
          ...item,
          precioSeleccionado: nextPrice.key,
          precioUnitario: nextPrice.value,
          total: Math.round(item.cantidad * nextPrice.value * 100) / 100,
        }
      }),
    )
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItems((current) => current.filter((i) => i.id !== itemId))
  }, [])

  const clearCart = useCallback(() => {
    setItems([])
    setCustomerMode('generico')
    setClienteData({ nombre: 'Consumidor final', documento: '99999999', clinicalCustomerId: null })
    setMetodoPago('Efectivo')
    setMontoEfectivo(0)
    setMontoDigital(0)
    setErrors([])
    setLastVenta(null)
  }, [])

  const submitVenta = useCallback(async (): Promise<boolean> => {
    setErrors([])

    if (items.length === 0) {
      setErrors(['El carrito está vacío'])
      return false
    }
    if (totals.total <= 0) {
      setErrors(['El total de la venta debe ser mayor a 0'])
      return false
    }
    const invalidPriceItem = items.find((item) => (
      item.precioUnitario <= 0 ||
      !item.preciosVenta.some((price) => price.key === item.precioSeleccionado && price.value === item.precioUnitario)
    ))
    if (invalidPriceItem) {
      setErrors([`Precio de venta inválido para ${invalidPriceItem.productoNombre}`])
      return false
    }

    const saleItems: ApiPOSSaleItem[] = items.map((item) => ({
      productoId: item.productoId,
      productoNombre: item.productoNombre,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      total: item.total,
    }))

    const notes = items
      .map(
        (i) =>
          `${i.productoNombre} | cant: ${i.cantidad} | p.u.: ${i.precioUnitario.toFixed(2)} | sub: ${i.total.toFixed(2)}`,
      )
      .join('\n')

    setIsProcessing(true)
    try {
      const montoEfectivoVenta = metodoPago === 'Yape' ? 0 : Math.round(montoEfectivo * 100) / 100
      const montoDigitalVenta = metodoPago === 'Mixto'
        ? Math.max(0, Math.round((totals.total - montoEfectivoVenta) * 100) / 100)
        : metodoPago === 'Yape'
          ? totals.total
          : 0
      const vueltoVenta = metodoPago === 'Efectivo' || metodoPago === 'Mixto'
        ? Math.max(0, Math.round((montoEfectivoVenta - totals.total) * 100) / 100)
        : 0

      const result = await apiPOSCrearVenta({
        customer: clienteData.nombre,
        customerId: customerMode === 'clinica' ? clienteData.clinicalCustomerId || undefined : undefined,
        documentId: clienteData.documento || undefined,
        customerMode,
        paymentMethod: metodoPago,
        montoEfectivo: montoEfectivoVenta,
        montoDigital: montoDigitalVenta,
        vuelto: vueltoVenta,
        metodoPagoSecundario: metodoPago === 'Mixto' ? 'Yape' : undefined,
        total: totals.total,
        cashier: 'Caja principal',
        area: 'Botica',
        notes,
        almacenId: almacenId || undefined,
        items: saleItems,
      })
      setLastVenta({ id: result.id, codigo: result.codigo })
      return true
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error al procesar la venta'
      setErrors([msg])
      return false
    } finally {
      setIsProcessing(false)
    }
  }, [items, totals.total, clienteData, customerMode, metodoPago, montoEfectivo, almacenId])

  return {
    items,
    patients,
    almacenes,
    almacenId,
    customerMode,
    clienteData,
    metodoPago,
    montoEfectivo,
    montoDigital,
    isProcessing,
    errors,
    lastVenta,
    subtotal: totals.subtotal,
    montoIgv: totals.montoIgv,
    total: totals.total,
    vuelto,
    setAlmacenId,
    setCustomerMode,
    setClienteData,
    setMetodoPago,
    setMontoEfectivo,
    setMontoDigital,
    addItem,
    updateQuantity,
    updatePrice,
    removeItem,
    clearCart,
    submitVenta,
  }
}
