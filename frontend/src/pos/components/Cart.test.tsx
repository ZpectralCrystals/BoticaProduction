import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cart } from './Cart'
import type { CartItem } from '../types'

const NOOP = vi.fn()

const CART_PROPS = {
  subtotal: 0,
  montoIgv: 0,
  total: 0,
  onUpdateQuantity: NOOP,
  onUpdatePrice: NOOP,
  onRemoveItem: NOOP,
  onClearCart: NOOP,
  onCheckout: NOOP,
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'item-1',
    productoId: 1,
    productoCodigo: 'MED-001',
    productoNombre: 'Paracetamol 500mg',
    categoria: 'MEDICAMENTO',
    stock: 100,
    expiresAt: null,
    cantidad: 2,
    precioUnitario: 5,
    precioSeleccionado: 'precioVenta1',
    preciosVenta: [{ key: 'precioVenta1', label: 'Precio 1', value: 5 }],
    total: 10,
    receta: 'N',
    alertas: [],
    fefoLote: null,
    fefoLotes: [],
    ...overrides,
  }
}

// ── Estado vacío ────────────────────────────────────────────

describe('Cart — estado vacío', () => {
  it('muestra mensaje de carrito vacío', () => {
    render(<Cart items={[]} {...CART_PROPS} />)
    expect(screen.getByText('Carrito vacío')).toBeInTheDocument()
  })
})

// ── Ítem sin trazabilidad de lote ──────────────────────────

describe('Cart — ítem sin lotes', () => {
  it('muestra el nombre del producto', () => {
    render(<Cart items={[makeItem()]} {...CART_PROPS} total={10} subtotal={8.47} montoIgv={1.53} />)
    expect(screen.getByText('Paracetamol 500mg')).toBeInTheDocument()
  })

  it('no muestra indicador de lote cuando no hay trazabilidad', () => {
    render(<Cart items={[makeItem()]} {...CART_PROPS} total={10} subtotal={8.47} montoIgv={1.53} />)
    expect(screen.queryByText(/Sin trazabilidad de lote/)).not.toBeInTheDocument()
  })
})

// ── Ítem con lote FEFO único ───────────────────────────────

describe('Cart — ítem con lote FEFO', () => {
  const itemConLote = makeItem({
    fefoLote: {
      id: 10,
      codigoLote: 'L-TEST-001',
      fechaVencimiento: '2027-06-01',
      cantidad: 80,
      diasParaVencer: 400,
      alerta: 'OK',
      stockAcumulado: 80,
    },
    fefoLotes: [
      {
        id: 10,
        codigoLote: 'L-TEST-001',
        fechaVencimiento: '2027-06-01',
        cantidad: 80,
        diasParaVencer: 400,
        alerta: 'OK',
        stockAcumulado: 80,
      },
    ],
  })

  it('oculta el código del lote en el carrito', () => {
    render(<Cart items={[itemConLote]} {...CART_PROPS} total={10} subtotal={8.47} montoIgv={1.53} />)
    expect(screen.queryByText(/L-TEST-001/)).not.toBeInTheDocument()
  })

  it('oculta la fecha de vencimiento del lote en el carrito', () => {
    render(<Cart items={[itemConLote]} {...CART_PROPS} total={10} subtotal={8.47} montoIgv={1.53} />)
    expect(screen.queryByText(/2027-06-01/)).not.toBeInTheDocument()
  })
})

// ── Ítem con lote crítico ──────────────────────────────────

describe('Cart — lote CRITICO', () => {
  const itemCritico = makeItem({
    fefoLote: {
      id: 10,
      codigoLote: 'L-CRIT-001',
      fechaVencimiento: '2026-05-01',
      cantidad: 10,
      diasParaVencer: 20,
      alerta: 'CRITICO',
      stockAcumulado: 10,
    },
    fefoLotes: [
      {
        id: 10,
        codigoLote: 'L-CRIT-001',
        fechaVencimiento: '2026-05-01',
        cantidad: 10,
        diasParaVencer: 20,
        alerta: 'CRITICO',
        stockAcumulado: 10,
      },
    ],
    alertas: [
      { tipo: 'VENCIMIENTO', severidad: 'ALTA', mensaje: 'Lote vence en 20 días' },
    ],
  })

  it('oculta el código del lote crítico', () => {
    render(<Cart items={[itemCritico]} {...CART_PROPS} total={10} subtotal={8.47} montoIgv={1.53} />)
    expect(screen.queryByText(/L-CRIT-001/)).not.toBeInTheDocument()
  })

  it('muestra la alerta de vencimiento', () => {
    render(<Cart items={[itemCritico]} {...CART_PROPS} total={10} subtotal={8.47} montoIgv={1.53} />)
    expect(screen.getByText(/Lote vence en 20 días/)).toBeInTheDocument()
  })
})

// ── Multi-lote ─────────────────────────────────────────────

describe('Cart — multi-lote FEFO', () => {
  const loteA = { id: 1, codigoLote: 'L-A', fechaVencimiento: '2026-06-01', cantidad: 3, diasParaVencer: 50, alerta: 'PROXIMO' as const, stockAcumulado: 3 }
  const loteB = { id: 2, codigoLote: 'L-B', fechaVencimiento: '2026-12-01', cantidad: 50, diasParaVencer: 230, alerta: 'OK' as const, stockAcumulado: 53 }

  const itemMultiLote = makeItem({
    cantidad: 5,
    fefoLote: loteA,
    fefoLotes: [loteA, loteB],
  })

  it('oculta badge "FEFO Multi-lote"', () => {
    render(<Cart items={[itemMultiLote]} {...CART_PROPS} total={25} subtotal={21.19} montoIgv={3.81} />)
    expect(screen.queryByText(/Multi-lote/)).not.toBeInTheDocument()
  })

  it('oculta ambos lotes en la distribución', () => {
    render(<Cart items={[itemMultiLote]} {...CART_PROPS} total={25} subtotal={21.19} montoIgv={3.81} />)
    expect(screen.queryByText(/L-A/)).not.toBeInTheDocument()
    expect(screen.queryByText(/L-B/)).not.toBeInTheDocument()
  })
})

// ── Interacciones ──────────────────────────────────────────

describe('Cart — interacciones', () => {
  it('llama onRemoveItem al hacer clic en X', async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    render(
      <Cart
        items={[makeItem()]}
        {...CART_PROPS}
        onRemoveItem={onRemove}
        total={10}
        subtotal={8.47}
        montoIgv={1.53}
      />,
    )

    await user.click(screen.getByLabelText('Quitar Paracetamol 500mg'))
    expect(onRemove).toHaveBeenCalledWith('item-1')
  })

  it('llama onCheckout al hacer clic en Proceder al pago', async () => {
    const onCheckout = vi.fn()
    const user = userEvent.setup()
    render(
      <Cart
        items={[makeItem()]}
        {...CART_PROPS}
        onCheckout={onCheckout}
        total={10}
        subtotal={8.47}
        montoIgv={1.53}
      />,
    )

    await user.click(screen.getByText(/Proceder al pago/))
    expect(onCheckout).toHaveBeenCalledOnce()
  })

  it('permite editar la cantidad manualmente por teclado', async () => {
    const onUpdateQuantity = vi.fn()
    const user = userEvent.setup()
    render(
      <Cart
        items={[makeItem()]}
        {...CART_PROPS}
        onUpdateQuantity={onUpdateQuantity}
        total={10}
        subtotal={8.47}
        montoIgv={1.53}
      />,
    )

    const input = screen.getByLabelText('Cantidad de Paracetamol 500mg')
    await user.clear(input)
    await user.type(input, '12')

    expect(input).toHaveValue('12')
    expect(onUpdateQuantity).toHaveBeenLastCalledWith('item-1', 12)
  })

  it('limita cantidad manual al stock disponible', async () => {
    const onUpdateQuantity = vi.fn()
    const user = userEvent.setup()
    render(
      <Cart
        items={[makeItem({ stock: 8 })]}
        {...CART_PROPS}
        onUpdateQuantity={onUpdateQuantity}
        total={10}
        subtotal={8.47}
        montoIgv={1.53}
      />,
    )

    const input = screen.getByLabelText('Cantidad de Paracetamol 500mg')
    await user.clear(input)
    await user.type(input, '99')

    expect(input).toHaveValue('8')
    expect(onUpdateQuantity).toHaveBeenLastCalledWith('item-1', 8)
  })
})
