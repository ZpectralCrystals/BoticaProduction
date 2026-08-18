import type { CartItem } from '../types'

/**
 * Generar ID único para items del carrito
 */
export function generarIdUnico(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calcular unidades base según el tipo de venta
 */
export function calcularUnidadesBase(
  cantidad: number,
  unidadMedida: 'UNIDAD' | 'CAJA' | 'BLISTER',
  unidadesPorCaja: number,
  unidadesPorBlister?: number | null
): { cantidadUnidades: number; esFraccionado: boolean; factorConversion: number } {
  switch (unidadMedida) {
    case 'CAJA':
      return {
        cantidadUnidades: cantidad * unidadesPorCaja,
        esFraccionado: false,
        factorConversion: unidadesPorCaja,
      }
    case 'BLISTER':
      if (!unidadesPorBlister) {
        throw new Error('El producto no tiene configurado unidades por blister')
      }
      return {
        cantidadUnidades: cantidad * unidadesPorBlister,
        esFraccionado: true,
        factorConversion: unidadesPorBlister,
      }
    case 'UNIDAD':
    default:
      return {
        cantidadUnidades: cantidad,
        esFraccionado: true,
        factorConversion: 1,
      }
  }
}

/**
 * Calcular totales de la venta (precios IGV incluido)
 */
export function calcularTotales(
  items: CartItem[],
): { subtotal: number; montoIgv: number; total: number } {
  const total = Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) / 100
  const subtotal = Math.round((total / 1.18) * 100) / 100
  const montoIgv = Math.round((total - subtotal) * 100) / 100

  return { subtotal, montoIgv, total }
}

/**
 * Formatear número con separadores
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Formatear fecha
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * Calcular días hasta vencimiento (retorna null si no hay fecha)
 */
export function diasHastaVencimiento(fechaVencimiento: string | null | undefined): number | null {
  if (!fechaVencimiento) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const vencimiento = new Date(fechaVencimiento)
  vencimiento.setHours(0, 0, 0, 0)
  const diffTime = vencimiento.getTime() - hoy.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Determinar clase de color según días para vencer
 */
export function getVencimientoColorClass(dias: number | null): string {
  if (dias === null) return 'text-muted bg-muted/20 border-muted/30'
  if (dias <= 0) return 'text-red-600 bg-red-50 border-red-200'
  if (dias <= 7) return 'text-red-500 bg-red-50/50 border-red-100'
  if (dias <= 30) return 'text-amber-500 bg-amber-50 border-amber-100'
  return 'text-emerald-600 bg-emerald-50 border-emerald-100'
}

/**
 * Determinar texto de severidad
 */
export function getVencimientoText(dias: number | null): string {
  if (dias === null) return 'Sin fecha'
  if (dias <= 0) return 'VENCIDO'
  if (dias <= 7) return 'Vence pronto'
  if (dias <= 30) return `Vence en ${dias} días`
  return 'Vigente'
}

/**
 * Calcular vuelto
 */
export function calcularVuelto(total: number, montoEfectivo: number, montoDigital: number): number {
  const totalPagado = montoEfectivo + montoDigital
  return Math.max(0, totalPagado - total)
}

/**
 * Debounce para búsqueda
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delay: number
): (...args: Args) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}
