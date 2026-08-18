/**
 * Tipos del módulo POS (Point of Sale)
 * Alineados al backend Fastify + PostgreSQL activo
 */

// ==========================================
// Método de pago (valores que acepta el backend)
// ==========================================

export type MetodoPago = 'Efectivo' | 'Yape' | 'Mixto'
export type CustomerMode = 'generico' | 'clinica'

// ==========================================
// Carrito de Venta
// ==========================================

export interface LoteFefo {
  id: number
  codigoLote: string | null
  fechaVencimiento: string
  cantidad: number
  diasParaVencer: number
  alerta: 'CRITICO' | 'PROXIMO' | 'OK'
  stockAcumulado: number
}

export interface SalePriceOption {
  key: 'precioVenta1' | 'precioVenta2' | 'precioVenta3'
  label: 'Precio 1' | 'Precio 2' | 'Precio 3'
  value: number
}

export interface CartItem {
  id: string
  productoId: number
  productoCodigo: string
  productoNombre: string
  categoria: string
  stock: number
  expiresAt: string | null
  cantidad: number
  precioUnitario: number
  precioSeleccionado: SalePriceOption['key']
  preciosVenta: SalePriceOption[]
  total: number
  receta: 'S' | 'N'
  alertas: ItemAlerta[]
  fefoLote: LoteFefo | null
  fefoLotes: LoteFefo[]
}

export interface ItemAlerta {
  tipo: 'VENCIMIENTO' | 'STOCK_BAJO' | 'RECETA'
  severidad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'
  mensaje: string
}

export interface PosPatientOption {
  id: number
  fullName: string
  documentId: string
}
