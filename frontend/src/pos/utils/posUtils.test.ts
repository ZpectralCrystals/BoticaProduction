import { describe, it, expect } from 'vitest'
import {
  calcularTotales,
  calcularVuelto,
  diasHastaVencimiento,
  getVencimientoColorClass,
  getVencimientoText,
  generarIdUnico,
} from './posUtils'
import type { CartItem } from '../types'

// ── Helpers ──────────────────────────────────────────────

function makeItem(cantidad: number, precioUnitario: number): CartItem {
  return {
    id: 'x',
    productoId: 1,
    productoCodigo: 'MED-001',
    productoNombre: 'Test',
    categoria: 'MEDICAMENTO',
    stock: 100,
    expiresAt: null,
    cantidad,
    precioUnitario,
    precioSeleccionado: 'precioVenta1',
    preciosVenta: [{ key: 'precioVenta1', label: 'Precio 1', value: precioUnitario }],
    total: cantidad * precioUnitario,
    receta: 'N',
    alertas: [],
    fefoLote: null,
    fefoLotes: [],
  }
}

// ── calcularTotales ────────────────────────────────────────

describe('calcularTotales', () => {
  it('retorna cero en carrito vacío', () => {
    const r = calcularTotales([])
    expect(r.total).toBe(0)
    expect(r.subtotal).toBe(0)
    expect(r.montoIgv).toBe(0)
  })

  it('calcula correctamente con un ítem de S/118', () => {
    const r = calcularTotales([makeItem(1, 118)])
    expect(r.total).toBe(118)
    expect(r.subtotal).toBeCloseTo(100, 2)
    expect(r.montoIgv).toBeCloseTo(18, 2)
  })

  it('suma múltiples ítems correctamente', () => {
    const items = [makeItem(2, 50), makeItem(3, 20)]
    const r = calcularTotales(items)
    expect(r.total).toBe(160)
  })

  it('subtotal + igv = total (sin desvío de redondeo)', () => {
    const r = calcularTotales([makeItem(5, 37.5)])
    expect(r.subtotal + r.montoIgv).toBeCloseTo(r.total, 1)
  })
})

// ── calcularVuelto ─────────────────────────────────────────

describe('calcularVuelto', () => {
  it('retorna 0 si pagó exacto', () => {
    expect(calcularVuelto(50, 50, 0)).toBe(0)
  })

  it('retorna el vuelto correcto', () => {
    expect(calcularVuelto(50, 100, 0)).toBe(50)
  })

  it('suma efectivo + digital para calcular vuelto', () => {
    expect(calcularVuelto(100, 60, 60)).toBe(20)
  })

  it('nunca es negativo (pago incompleto)', () => {
    expect(calcularVuelto(100, 30, 0)).toBe(0)
  })
})

// ── diasHastaVencimiento ──────────────────────────────────

describe('diasHastaVencimiento', () => {
  it('retorna null si no hay fecha', () => {
    expect(diasHastaVencimiento(null)).toBeNull()
    expect(diasHastaVencimiento(undefined)).toBeNull()
  })

  it('retorna 0 o negativo para una fecha en el pasado', () => {
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    const fecha = ayer.toISOString().split('T')[0]
    const dias = diasHastaVencimiento(fecha)
    expect(dias).toBeLessThanOrEqual(0)
  })

  it('retorna positivo para una fecha en el futuro', () => {
    const proxYear = new Date()
    proxYear.setFullYear(proxYear.getFullYear() + 1)
    const fecha = proxYear.toISOString().split('T')[0]
    const dias = diasHastaVencimiento(fecha)
    expect(dias).toBeGreaterThan(300)
  })
})

// ── getVencimientoColorClass ────────────────────────────────

describe('getVencimientoColorClass', () => {
  it('rojo para días <= 0 (vencido)', () => {
    expect(getVencimientoColorClass(0)).toContain('red-600')
    expect(getVencimientoColorClass(-5)).toContain('red-600')
  })

  it('rojo para días <= 7', () => {
    expect(getVencimientoColorClass(5)).toContain('red-500')
  })

  it('amarillo para días <= 30', () => {
    expect(getVencimientoColorClass(20)).toContain('amber')
  })

  it('verde para días > 30', () => {
    expect(getVencimientoColorClass(60)).toContain('emerald')
  })

  it('neutro si dias es null', () => {
    expect(getVencimientoColorClass(null)).toContain('muted')
  })
})

// ── getVencimientoText ─────────────────────────────────────

describe('getVencimientoText', () => {
  it('"VENCIDO" cuando días <= 0', () => {
    expect(getVencimientoText(0)).toBe('VENCIDO')
    expect(getVencimientoText(-3)).toBe('VENCIDO')
  })

  it('"Vence pronto" cuando días <= 7', () => {
    expect(getVencimientoText(7)).toBe('Vence pronto')
  })

  it('incluye días restantes cuando <= 30', () => {
    expect(getVencimientoText(25)).toContain('25')
  })

  it('"Vigente" cuando días > 30', () => {
    expect(getVencimientoText(100)).toBe('Vigente')
  })
})

// ── generarIdUnico ─────────────────────────────────────────

describe('generarIdUnico', () => {
  it('genera strings distintos en cada llamada', () => {
    const ids = Array.from({ length: 100 }, () => generarIdUnico())
    const unicos = new Set(ids)
    expect(unicos.size).toBe(100)
  })
})
