import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePOS } from './usePOS'

vi.mock('@/lib/api', () => ({
  apiGetLotesDisponibles: vi.fn(),
  apiPOSCrearVenta: vi.fn(),
  apiGetPatients: vi.fn().mockResolvedValue([]),
  apiGetAlmacenes: vi.fn().mockResolvedValue([
    { id: 1, localId: 1, localNombre: 'Botica', localTipo: 'BOTICA', nombre: 'Botica – Disponible', codigo: 'ALM-BOT-DISP', tipoAlmacen: 'DISPONIBLE', permiteVenta: true, permiteConsumoClinico: false, requiereRevision: false, estado: 'A', creado: '', lotesActivos: 0, stockTotal: 0 },
  ]),
}))

import { apiGetLotesDisponibles, apiPOSCrearVenta } from '@/lib/api'

const MOCK_PRODUCT = {
  id: 1,
  codigo: 'MED-001',
  nombre: 'Paracetamol 500mg',
  generico: 'Paracetamol',
  categoria: 'MEDICAMENTO',
  familia: 'ANALGESICO',
  presentacion: 'TABLETA',
  precioVenta: 5.0,
  precioVenta1: 5.0,
  precioVenta2: null,
  precioVenta3: null,
  stock: 100,
  expiresAt: null,
  receta: 'N',
}

const MOCK_LOTE = {
  id: 10,
  codigoLote: 'L-TEST-001',
  fechaVencimiento: '2027-01-01',
  cantidad: 80,
  cantidadInicial: 100,
  diasParaVencer: 270,
  alerta: 'OK' as const,
  stockAcumulado: 80,
}

function setupLoteOK() {
  vi.mocked(apiGetLotesDisponibles).mockResolvedValue({
    success: true,
    data: {
      productoId: 1,
      productoNombre: 'Paracetamol 500mg',
      productoCodigo: 'MED-001',
      stockTotal: 80,
      stockEnLotes: 80,
      stockSinLote: 0,
      tieneLottes: true,
      lotes: [MOCK_LOTE],
    },
  })
}

function setupSinLotes() {
  vi.mocked(apiGetLotesDisponibles).mockResolvedValue({
    success: true,
    data: {
      productoId: 1,
      productoNombre: 'Paracetamol 500mg',
      productoCodigo: 'MED-001',
      stockTotal: 100,
      stockEnLotes: 0,
      stockSinLote: 100,
      tieneLottes: false,
      lotes: [],
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── addItem ────────────────────────────────────────────────

describe('usePOS.addItem', () => {
  it('agrega producto al carrito', async () => {
    setupLoteOK()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].productoId).toBe(1)
  })

  it('adjunta fefoLote al ítem cuando el backend retorna lotes', async () => {
    setupLoteOK()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    expect(result.current.items[0].fefoLote).not.toBeNull()
    expect(result.current.items[0].fefoLote?.codigoLote).toBe('L-TEST-001')
    expect(result.current.items[0].fefoLotes).toHaveLength(1)
  })

  it('fefoLote es null si el producto no tiene lotes', async () => {
    setupSinLotes()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    expect(result.current.items[0].fefoLote).toBeNull()
    expect(result.current.items[0].fefoLotes).toHaveLength(0)
  })

  it('agrega igual si apiGetLotesDisponibles falla (graceful fallback)', async () => {
    vi.mocked(apiGetLotesDisponibles).mockRejectedValue(new Error('Network error'))
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].fefoLote).toBeNull()
  })

  it('incrementa cantidad si el producto ya estaba en carrito', async () => {
    setupLoteOK()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
      await result.current.addItem(MOCK_PRODUCT)
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].cantidad).toBe(2)
  })

  it('no supera el stock disponible en lotes al hacer +', async () => {
    vi.mocked(apiGetLotesDisponibles).mockResolvedValue({
      success: true,
      data: {
        productoId: 1,
        productoNombre: 'Paracetamol 500mg',
        productoCodigo: 'MED-001',
        stockTotal: 2,
        stockEnLotes: 2,
        stockSinLote: 0,
        tieneLottes: true,
        lotes: [{ ...MOCK_LOTE, cantidad: 2 }],
      },
    })

    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
      await result.current.addItem(MOCK_PRODUCT)
      await result.current.addItem(MOCK_PRODUCT)
    })

    expect(result.current.items[0].cantidad).toBeLessThanOrEqual(2)
  })
})

// ── updateQuantity ─────────────────────────────────────────

describe('usePOS.updateQuantity', () => {
  it('actualiza la cantidad y recalcula el total', async () => {
    setupSinLotes()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    act(() => {
      result.current.updateQuantity(result.current.items[0].id, 4)
    })

    expect(result.current.items[0].cantidad).toBe(4)
    expect(result.current.items[0].total).toBeCloseTo(20, 2)
  })

  it('no baja de 1', async () => {
    setupSinLotes()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    act(() => {
      result.current.updateQuantity(result.current.items[0].id, 0)
    })

    expect(result.current.items[0].cantidad).toBe(1)
  })

  it('limita al stock de lotes cuando fefoLotes existen', async () => {
    setupLoteOK()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    act(() => {
      result.current.updateQuantity(result.current.items[0].id, 9999)
    })

    expect(result.current.items[0].cantidad).toBe(80)
  })
})

// ── calcularTotales / totals ───────────────────────────────

describe('usePOS totales', () => {
  it('total es 0 con carrito vacío', () => {
    const { result } = renderHook(() => usePOS())
    expect(result.current.total).toBe(0)
  })

  it('recalcula total al agregar ítems', async () => {
    setupSinLotes()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    expect(result.current.total).toBe(5.0)
  })
})

// ── submitVenta ────────────────────────────────────────────

describe('usePOS.submitVenta', () => {
  it('llama a apiPOSCrearVenta con los ítems correctos', async () => {
    setupSinLotes()
    vi.mocked(apiPOSCrearVenta).mockResolvedValue({ ok: true, id: '1', codigo: 'VTA-001' })

    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
      result.current.setMontoEfectivo(10)
    })

    let ok = false
    await act(async () => {
      ok = await result.current.submitVenta()
    })

    expect(ok).toBe(true)
    expect(apiPOSCrearVenta).toHaveBeenCalledOnce()
    expect(apiPOSCrearVenta).toHaveBeenCalledWith(
      expect.objectContaining({
        montoEfectivo: 10,
        montoDigital: 0,
        vuelto: 5,
        items: expect.arrayContaining([
          expect.objectContaining({ productoId: 1 }),
        ]),
      }),
    )
  })

  it('envía desglose auditable para pago mixto', async () => {
    setupSinLotes()
    vi.mocked(apiPOSCrearVenta).mockResolvedValue({ ok: true, id: '1', codigo: 'VTA-001' })

    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
      result.current.setMetodoPago('Mixto')
      result.current.setMontoEfectivo(2)
    })

    let ok = false
    await act(async () => {
      ok = await result.current.submitVenta()
    })

    expect(ok).toBe(true)
    expect(apiPOSCrearVenta).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: 'Mixto',
        montoEfectivo: 2,
        montoDigital: 3,
        vuelto: 0,
        metodoPagoSecundario: 'Yape',
      }),
    )
  })

  it('retorna false y registra error si la API falla', async () => {
    setupSinLotes()
    vi.mocked(apiPOSCrearVenta).mockRejectedValue(new Error('Error de red'))

    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
      result.current.setMontoEfectivo(10)
    })

    let ok = true
    await act(async () => {
      ok = await result.current.submitVenta()
    })

    expect(ok).toBe(false)
    expect(result.current.errors).toContain('Error de red')
  })

  it('muestra mensaje claro si backend rechaza venta por caja cerrada', async () => {
    setupSinLotes()
    vi.mocked(apiPOSCrearVenta).mockRejectedValue(new Error('NO HAY CAJA ABIERTA. Abra caja antes de registrar ventas.'))

    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
      result.current.setMontoEfectivo(10)
    })

    let ok = true
    await act(async () => {
      ok = await result.current.submitVenta()
    })

    expect(ok).toBe(false)
    expect(result.current.errors).toContain('NO HAY CAJA ABIERTA. Abra caja antes de registrar ventas.')
  })

  it('retorna false con carrito vacío', async () => {
    const { result } = renderHook(() => usePOS())

    let ok = true
    await act(async () => {
      ok = await result.current.submitVenta()
    })

    expect(ok).toBe(false)
    expect(result.current.errors).toHaveLength(1)
  })

  it('clearCart reinicia el estado completamente', async () => {
    setupSinLotes()
    const { result } = renderHook(() => usePOS())

    await act(async () => {
      await result.current.addItem(MOCK_PRODUCT)
    })

    act(() => {
      result.current.clearCart()
    })

    expect(result.current.items).toHaveLength(0)
    expect(result.current.total).toBe(0)
    expect(result.current.errors).toHaveLength(0)
  })
})
