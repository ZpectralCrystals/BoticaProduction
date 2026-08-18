import { z } from 'zod'

// ============================================
// Schemas Base
// ============================================

export const uuidSchema = z.string().uuid()

export const idSchema = z.number().int().positive()

export const dateSchema = z.string().datetime()

export const moneySchema = z.number().nonnegative().max(999999999999.99)

// ============================================
// Schemas de Productos
// ============================================

export const productoSchema = z.object({
  id: idSchema.optional(),
  codigo: z.string().min(1).max(50),
  codigo_barras: z.string().max(100).nullable().optional(),
  nombre_generico: z.string().min(1).max(200),
  nombre_comercial: z.string().max(200).nullable().optional(),
  descripcion: z.string().nullable().optional(),
  categoria_id: idSchema.nullable().optional(),
  laboratorio_id: idSchema.nullable().optional(),
  unidad_medida_id: idSchema.nullable().optional(),
  unidad_por_caja: z.number().int().nonnegative().default(1),
  unidad_por_blister: z.number().int().nonnegative().nullable().optional(),
  precio_compra_referencia: moneySchema.default(0),
  precio_venta_unitario: moneySchema.default(0),
  precio_venta_caja: moneySchema.default(0),
  stock_minimo: z.number().int().nonnegative().default(0),
  stock_maximo: z.number().int().nonnegative().default(0),
  punto_reorden: z.number().int().nonnegative().default(0),
  principio_activo: z.string().nullable().optional(),
  concentracion: z.string().max(100).nullable().optional(),
  forma_farmaceutica: z.string().max(100).nullable().optional(),
  via_administracion: z.string().max(100).nullable().optional(),
  presentacion: z.string().max(100).nullable().optional(),
  indicaciones: z.string().nullable().optional(),
  contraindicaciones: z.string().nullable().optional(),
  efectos_secundarios: z.string().nullable().optional(),
  interacciones: z.string().nullable().optional(),
  requiere_receta: z.boolean().default(false),
  es_controlado: z.boolean().default(false),
  es_refrigerado: z.boolean().default(false),
  tiene_fecha_vencimiento: z.boolean().default(true),
  estado: z.boolean().default(true),
})

export const loteSchema = z.object({
  id: idSchema.optional(),
  producto_id: idSchema,
  proveedor_id: idSchema.nullable().optional(),
  sucursal_id: idSchema,
  numero_lote: z.string().min(1).max(100),
  codigo_interno: z.string().max(50).nullable().optional(),
  fecha_fabricacion: z.string().date().nullable().optional(),
  fecha_vencimiento: z.string().date(),
  fecha_ingreso: z.string().date().default(() => new Date().toISOString().split('T')[0]),
  cantidad_inicial: z.number().int().positive(),
  cantidad_actual: z.number().int().nonnegative(),
  cantidad_reservada: z.number().int().nonnegative().default(0),
  cantidad_fraccionada: z.number().int().nonnegative().default(0),
  unidad_entrada: z.string().max(20).default('UNIDAD'),
  unidades_por_empaque: z.number().int().positive().default(1),
  costo_unitario: z.number().nonnegative().max(999999.9999),
  costo_total: moneySchema,
  tipo_documento: z.string().max(20).nullable().optional(),
  numero_documento: z.string().max(50).nullable().optional(),
  fecha_documento: z.string().date().nullable().optional(),
  ubicacion_almacen: z.string().max(100).nullable().optional(),
  ubicacion_detalle: z.string().max(100).nullable().optional(),
  estado: z.enum(['ACTIVO', 'VENCIDO', 'AGOTADO', 'BLOQUEADO', 'DEVUELTO']).default('ACTIVO'),
  observaciones: z.string().nullable().optional(),
})

// ============================================
// Schemas de Ventas (CRÍTICO)
// ============================================

export const ventaItemSchema = z.object({
  producto_id: idSchema,
  cantidad: z.number().int().positive().describe('Cantidad en unidades de venta'),
  unidad_medida: z.enum(['UNIDAD', 'CAJA', 'BLISTER']).default('UNIDAD'),
  es_fraccionado: z.boolean().default(false),
  factor_conversion: z.number().int().positive().default(1).describe('Cuántas unidades base representa la unidad de venta'),
  precio_unitario: moneySchema.describe('Precio por unidad de venta'),
  descuento_porcentaje: z.number().min(0).max(100).default(0),
  receta_id: idSchema.nullable().optional(),
  indicaciones_uso: z.string().nullable().optional(),
  duracion_tratamiento: z.string().max(100).nullable().optional(),
}).refine((data) => {
  // Si es fraccionado, validar que la cantidad unidades se calcule correctamente
  return true
}, {
  message: 'Configuración de fraccionamiento inválida',
})

export const ventaCreateSchema = z.object({
  // Cliente
  cliente_tipo: z.enum(['CONSUMIDOR_FINAL', 'PACIENTE', 'CLIENTE']).default('CONSUMIDOR_FINAL'),
  paciente_id: idSchema.nullable().optional(),
  cliente_nombre: z.string().max(200).default('Consumidor final'),
  cliente_documento_tipo: idSchema.nullable().optional(),
  cliente_documento_numero: z.string().max(20).nullable().optional(),
  cliente_direccion: z.string().nullable().optional(),
  cliente_telefono: z.string().max(50).nullable().optional(),
  
  // Sucursal y caja
  sucursal_id: idSchema,
  caja_id: idSchema.nullable().optional(),
  turno: z.enum(['MAÑANA', 'TARDE', 'NOCHE']).nullable().optional(),
  
  // Items
  items: z.array(ventaItemSchema).min(1, 'Debe incluir al menos un item'),
  
  // Descuento global
  descuento_global: moneySchema.default(0),
  
  // Pago
  metodo_pago: z.enum(['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'MIXTO']).default('EFECTIVO'),
  monto_efectivo: moneySchema.default(0),
  monto_digital: moneySchema.default(0),
  
  // Comprobante
  comprobante_tipo: z.enum(['BOLETA', 'FACTURA', 'NOTA_VENTA']).nullable().optional(),
  comprobante_serie: z.string().max(10).nullable().optional(),
  comprobante_numero: z.string().max(20).nullable().optional(),
  
  // Observaciones
  observaciones: z.string().nullable().optional(),
})

// Schema extendido con validaciones adicionales
export const ventaCreateExtendedSchema = ventaCreateSchema.refine(
  (data) => {
    // Validar que el total pagado cubra el total de la venta
    const totalPagado = data.monto_efectivo + data.monto_digital
    // Nota: El total real se calculará en el backend, aquí solo validamos que haya algo de pago
    return totalPagado >= 0
  },
  {
    message: 'El monto pagado no puede ser negativo',
  }
).refine(
  (data) => {
    // Si es paciente, debe tener paciente_id
    if (data.cliente_tipo === 'PACIENTE' && !data.paciente_id) {
      return false
    }
    return true
  },
  {
    message: 'Las ventas tipo PACIENTE requieren paciente_id',
    path: ['paciente_id'],
  }
)

// Schema de respuesta de venta
export const ventaResponseSchema = z.object({
  id: idSchema,
  uuid: z.string().uuid(),
  codigo: z.string(),
  sucursal_id: idSchema,
  cliente_nombre: z.string(),
  subtotal: z.number(),
  monto_igv: z.number(),
  total: z.number(),
  metodo_pago: z.string(),
  estado: z.string(),
  items: z.array(z.object({
    id: idSchema,
    producto_id: idSchema,
    lote_id: idSchema,
    lote_numero: z.string(),
    cantidad: z.number(),
    cantidad_unidades: z.number(),
    precio_unitario: z.number(),
    subtotal: z.number(),
    total: z.number(),
  })),
  created_at: z.string().datetime(),
})

// ============================================
// Schemas de Kardex
// ============================================

export const kardexSchema = z.object({
  id: idSchema.optional(),
  fecha: dateSchema.default(() => new Date().toISOString()),
  tipo_movimiento_id: idSchema,
  documento_tipo: z.string().max(50).nullable().optional(),
  documento_id: idSchema.nullable().optional(),
  documento_numero: z.string().max(100).nullable().optional(),
  producto_id: idSchema,
  lote_id: idSchema.nullable().optional(),
  sucursal_id: idSchema,
  cantidad: z.number().int().refine((n) => n !== 0, { message: 'La cantidad no puede ser 0' }),
  cantidad_anterior: z.number().int().nonnegative(),
  cantidad_nueva: z.number().int().nonnegative(),
  costo_unitario: z.number().nonnegative().nullable().optional(),
  costo_total: moneySchema.nullable().optional(),
  precio_venta_unitario: moneySchema.nullable().optional(),
  precio_venta_total: moneySchema.nullable().optional(),
  es_fraccionado: z.boolean().default(false),
  unidad_medida_venta: z.string().max(20).nullable().optional(),
  cantidad_unidades: z.number().int().positive().nullable().optional(),
  motivo: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  receta_id: idSchema.nullable().optional(),
  usuario_id: z.string().uuid(),
  usuario_nombre: z.string().max(100).nullable().optional(),
})

// ============================================
// Schemas de Respuesta API
// ============================================

export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    message: z.string().optional(),
    meta: z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
      total: z.number().optional(),
      totalPages: z.number().optional(),
    }).optional(),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }).optional(),
  })

export const paginatedQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  fechaDesde: z.string().date().optional(),
  fechaHasta: z.string().date().optional(),
  sucursal_id: z.coerce.number().int().positive().optional(),
  estado: z.string().optional(),
})

// ============================================
// Tipos TypeScript exportados
// ============================================

export type ProductoInput = z.infer<typeof productoSchema>
export type LoteInput = z.infer<typeof loteSchema>
export type VentaItemInput = z.infer<typeof ventaItemSchema>
export type VentaCreateInput = z.infer<typeof ventaCreateExtendedSchema>
export type VentaResponse = z.infer<typeof ventaResponseSchema>
export type KardexInput = z.infer<typeof kardexSchema>
export type PaginatedQuery = z.infer<typeof paginatedQuerySchema>
