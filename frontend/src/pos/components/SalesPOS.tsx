import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ShoppingCart } from 'lucide-react'
import type { ApiPOSProduct } from '@/lib/api'
import { usePOS } from '../hooks/usePOS'
import { ProductSearch } from './ProductSearch'
import { Cart } from './Cart'
import { PaymentPanel } from './PaymentPanel'
import { CheckoutModal } from './CheckoutModal'
import type { CustomerMode } from '../types'

export function SalesPOS() {
  const pos = usePOS()
  const {
    addItem,
    clearCart,
    items,
    lastVenta,
    patients,
    removeItem,
    setAlmacenId,
    setClienteData,
    setCustomerMode,
    submitVenta,
  } = pos
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

  const handleOpenCheckout = useCallback(() => {
    if (items.length > 0) {
      setIsCheckoutOpen(true)
    }
  }, [items.length])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F4' && pos.items.length > 0) {
        e.preventDefault()
        setIsCheckoutOpen(true)
      }
      if (e.key === 'Escape') {
        setIsCheckoutOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [pos.items.length])

  const handleConfirmCheckout = useCallback(async () => {
    const ok = await submitVenta()
    if (ok) {
      toast.success(`Venta registrada: ${lastVenta?.codigo ?? ''}`)
      setIsCheckoutOpen(false)
      clearCart()
    }
  }, [clearCart, lastVenta?.codigo, submitVenta])

  const handleProductSelect = useCallback(async (product: ApiPOSProduct) => {
    await addItem(product)
    toast.success(`${product.nombre} agregado al carrito`)
  }, [addItem])

  const handleRemoveItem = useCallback((id: string) => {
    removeItem(id)
    toast.success('Producto eliminado del carrito')
  }, [removeItem])

  const handleClearCart = useCallback(() => {
    clearCart()
    toast.success('Carrito vaciado')
  }, [clearCart])

  const handleCustomerModeChange = useCallback((mode: CustomerMode) => {
    setCustomerMode(mode)
    if (mode === 'generico') {
      setClienteData({ nombre: 'Consumidor final', documento: '99999999', clinicalCustomerId: null })
    } else {
      setClienteData({ nombre: '', documento: '', clinicalCustomerId: null })
    }
  }, [setClienteData, setCustomerMode])

  const handlePatientSelect = useCallback((patientId: number) => {
    const patient = patients.find((item) => item.id === patientId)
    setClienteData({
      nombre: patient?.fullName || '',
      documento: patient?.documentId || '',
      clinicalCustomerId: patient?.id || null,
    })
  }, [patients, setClienteData])

  const handleClienteDocumentoChange = useCallback((documento: string) => {
    setClienteData((d) => ({ ...d, documento, clinicalCustomerId: null }))
  }, [setClienteData])

  const handleClienteNombreChange = useCallback((nombre: string) => {
    setClienteData((d) => ({ ...d, nombre, clinicalCustomerId: null }))
  }, [setClienteData])

  const handleAlmacenChange = useCallback((value: string) => {
    setAlmacenId(Number(value) || null)
  }, [setAlmacenId])

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Terminal de Venta — Botica El Pueblo</h1>
            <p className="text-sm text-muted mt-0.5">
              F2 · buscar producto &nbsp;|&nbsp; F4 · finalizar venta &nbsp;|&nbsp; Esc · cancelar
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pos.almacenes.length > 1 && (
              <select
                className="rounded-lg border px-3 py-2 text-sm bg-surface"
                value={pos.almacenId ?? ''}
                onChange={(e) => handleAlmacenChange(e.target.value)}
              >
                {pos.almacenes.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            )}
            <span className="text-sm text-muted">
              {pos.items.length} ítem{pos.items.length !== 1 ? 's' : ''} en carrito
            </span>
            <button
              onClick={handleOpenCheckout}
              disabled={pos.items.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Finalizar venta (F4)
            </button>
          </div>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4 min-h-0">
        {/* Columna izquierda: búsqueda + carrito */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Búsqueda */}
          <div className="bg-surface rounded-xl shadow-sm border border-border p-5">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Buscar medicamento
            </p>
            <ProductSearch onProductSelect={handleProductSelect} />
          </div>

          {/* Carrito: queda debajo de la búsqueda, también en desktop */}
          <div className="bg-surface rounded-xl shadow-sm border border-border overflow-hidden">
            <Cart
              items={pos.items}
              subtotal={pos.subtotal}
              montoIgv={pos.montoIgv}
              total={pos.total}
              onUpdateQuantity={pos.updateQuantity}
              onUpdatePrice={pos.updatePrice}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              onCheckout={handleOpenCheckout}
            />
          </div>
        </div>

        {/* Columna derecha: cliente + pago */}
        <div className="flex flex-col min-h-0">
          <PaymentPanel
            total={pos.total}
            customerMode={pos.customerMode}
            patients={pos.patients}
            selectedClinicalCustomerId={pos.clienteData.clinicalCustomerId}
            metodoPago={pos.metodoPago}
            montoEfectivo={pos.montoEfectivo}
            montoDigital={pos.montoDigital}
            onCustomerModeChange={handleCustomerModeChange}
            onPatientSelect={handlePatientSelect}
            onMetodoPagoChange={pos.setMetodoPago}
            onMontoEfectivoChange={pos.setMontoEfectivo}
            onMontoDigitalChange={pos.setMontoDigital}
            clienteDocumento={pos.clienteData.documento}
            onClienteDocumentoChange={handleClienteDocumentoChange}
            clienteNombre={pos.clienteData.nombre}
            onClienteNombreChange={handleClienteNombreChange}
          />
        </div>
      </div>

      {/* Modal de checkout */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => !pos.isProcessing && setIsCheckoutOpen(false)}
        onConfirm={handleConfirmCheckout}
        items={pos.items}
        subtotal={pos.subtotal}
        montoIgv={pos.montoIgv}
        total={pos.total}
        metodoPago={pos.metodoPago}
        montoEfectivo={pos.montoEfectivo}
        montoDigital={pos.montoDigital}
        vuelto={pos.vuelto}
        clienteNombre={pos.clienteData.nombre}
        isProcessing={pos.isProcessing}
        errors={pos.errors}
      />
    </div>
  )
}
