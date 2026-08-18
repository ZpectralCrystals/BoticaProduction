import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '../types/database.js'
import { AppError, ValidationError } from '../plugins/error-handler.js'

/**
 * Interfaces para el módulo Kardex
 */
export interface KardexEntry {
  id: number
  fecha: string
  tipo_movimiento: string
  documento_numero: string | null
  numero_lote: string | null
  cantidad: number
  cantidad_anterior: number
  cantidad_nueva: number
  costo_unitario: number | null
  precio_venta: number | null
  usuario_nombre: string | null
  observaciones: string | null
}

export interface StockActual {
  producto_id: number
  producto_codigo: string
  producto_nombre: string
  presentacion: string | null
  sucursal_id: number
  sucursal_nombre: string
  stock_total_unidades: number
  stock_reservado: number
  stock_disponible: number
  costo_promedio_ponderado: number
  valor_inventario: number
  numero_lotes_activos: number
  fecha_vencimiento_proxima: string | null
  fecha_ultimo_movimiento: string | null
}

export interface MovimientoResumen {
  producto_codigo: string
  producto_nombre: string
  total_cantidad: number
  total_costo: number
  total_venta: number
  total_utilidad: number
}

export interface AjusteKardexInput {
  tipoMovimientoCodigo: string
  productoId: number
  loteId: number
  sucursalId: number
  cantidad: number // Positivo para entradas, negativo para salidas
  costoUnitario: number
  precioVenta?: number
  documentoTipo: string
  documentoNumero: string
  observaciones?: string
  motivoAjuste?: string
}

export interface KardexFilters {
  productoId?: number
  loteId?: number
  sucursalId?: number
  tipoMovimiento?: string
  fechaDesde?: string
  fechaHasta?: string
  documentoTipo?: string
  limit?: number
  offset?: number
}

/**
 * Servicio Kardex - Control de inventario y trazabilidad
 */
export class KardexService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Obtener historial completo (Kardex) de un producto
   */
  async getHistorialProducto(
    productoId: number,
    sucursalId?: number,
    fechaDesde?: string,
    fechaHasta?: string
  ): Promise<KardexEntry[]> {
    const { data, error } = await this.supabase.rpc('get_kardex_producto', {
      p_producto_id: productoId,
      p_sucursal_id: sucursalId ?? null,
      p_fecha_desde: fechaDesde ?? null,
      p_fecha_hasta: fechaHasta ?? null,
    })

    if (error) {
      throw new AppError('Error al obtener historial del producto: ' + error.message, 500)
    }

    return data ?? []
  }

  /**
   * Obtener stock actual consolidado por producto y sucursal
   */
  async getStockActual(
    sucursalId?: number,
    productoId?: number,
    options?: { page?: number; limit?: number }
  ): Promise<{ stock: StockActual[]; total: number }> {
    let query = this.supabase.from('vista_stock_actual').select('*', { count: 'exact' })

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    if (productoId) {
      query = query.eq('producto_id', productoId)
    }

    const page = options?.page ?? 1
    const limit = options?.limit ?? 50
    const from = (page - 1) * limit
    const to = from + limit - 1

    query = query.range(from, to).order('producto_nombre')

    const { data, error, count } = await query

    if (error) {
      throw new AppError('Error al obtener stock actual: ' + error.message, 500)
    }

    return {
      stock: (data as StockActual[]) ?? [],
      total: count ?? 0,
    }
  }

  /**
   * Buscar movimientos con filtros avanzados
   */
  async buscarMovimientos(filters: KardexFilters): Promise<{ movimientos: any[]; total: number }> {
    let query = this.supabase
      .from('vista_kardex_utilidad')
      .select('*', { count: 'exact' })

    if (filters.productoId) {
      query = query.eq('producto_id', filters.productoId)
    }

    if (filters.loteId) {
      query = query.eq('lote_id', filters.loteId)
    }

    if (filters.sucursalId) {
      query = query.eq('sucursal_id', filters.sucursalId)
    }

    if (filters.tipoMovimiento) {
      query = query.eq('tipo_movimiento', filters.tipoMovimiento)
    }

    if (filters.documentoTipo) {
      query = query.eq('documento_tipo', filters.documentoTipo)
    }

    if (filters.fechaDesde) {
      query = query.gte('fecha', filters.fechaDesde)
    }

    if (filters.fechaHasta) {
      query = query.lte('fecha', filters.fechaHasta)
    }

    const limit = filters.limit ?? 50
    const offset = filters.offset ?? 0

    query = query.order('fecha', { ascending: false }).range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      throw new AppError('Error al buscar movimientos: ' + error.message, 500)
    }

    return {
      movimientos: data ?? [],
      total: count ?? 0,
    }
  }

  /**
   * Obtener resumen de movimientos por tipo y período
   */
  async getResumenMovimientos(
    tipoMovimientoCodigo: string,
    fechaDesde: string,
    fechaHasta: string,
    sucursalId?: number
  ): Promise<MovimientoResumen[]> {
    const { data, error } = await this.supabase.rpc('get_movimientos_resumen', {
      p_tipo_movimiento: tipoMovimientoCodigo,
      p_fecha_desde: fechaDesde,
      p_fecha_hasta: fechaHasta,
      p_sucursal_id: sucursalId ?? null,
    })

    if (error) {
      throw new AppError('Error al obtener resumen: ' + error.message, 500)
    }

    return data ?? []
  }

  /**
   * Calcular stock histórico en una fecha específica
   */
  async getStockHistorico(productoId: number, sucursalId: number, fecha: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('get_stock_historico', {
      p_producto_id: productoId,
      p_sucursal_id: sucursalId,
      p_fecha: fecha,
    })

    if (error) {
      throw new AppError('Error al calcular stock histórico: ' + error.message, 500)
    }

    return data ?? 0
  }

  /**
   * Registrar movimiento manual en Kardex (ajuste, merma, etc.)
   */
  async registrarMovimiento(
    input: AjusteKardexInput,
    usuarioId: string,
    usuarioNombre: string
  ): Promise<number> {
    // Validaciones
    if (!input.tipoMovimientoCodigo) {
      throw new ValidationError('El tipo de movimiento es requerido')
    }

    if (input.cantidad === 0) {
      throw new ValidationError('La cantidad no puede ser cero')
    }

    // Validar que el lote existe y tiene suficiente stock si es salida
    if (input.cantidad < 0) {
      const { data: lote } = await this.supabase
        .from('lotes')
        .select('cantidad_actual')
        .eq('id', input.loteId)
        .single()

      if (!lote) {
        throw new ValidationError('El lote especificado no existe')
      }

      if (lote.cantidad_actual < Math.abs(input.cantidad)) {
        throw new ValidationError(
          `Stock insuficiente. Disponible: ${lote.cantidad_actual}, Solicitado: ${Math.abs(input.cantidad)}`
        )
      }
    }

    const { data, error } = await this.supabase.rpc('registrar_movimiento_kardex', {
      p_tipo_movimiento_codigo: input.tipoMovimientoCodigo,
      p_producto_id: input.productoId,
      p_lote_id: input.loteId,
      p_sucursal_id: input.sucursalId,
      p_cantidad: input.cantidad,
      p_costo_unitario: input.costoUnitario,
      p_precio_venta: input.precioVenta ?? 0,
      p_documento_tipo: input.documentoTipo,
      p_documento_numero: input.documentoNumero,
      p_usuario_id: usuarioId,
      p_usuario_nombre: usuarioNombre,
      p_motivo: input.motivoAjuste ?? input.observaciones ?? 'Movimiento manual',
    })

    if (error) {
      throw new AppError('Error al registrar movimiento: ' + error.message, 500)
    }

    return data as number
  }

  /**
   * Obtener último movimiento por lote (trazabilidad)
   */
  async getUltimoMovimientoLote(loteId: number): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('vista_trazabilidad_lote')
      .select('*')
      .eq('lote_id', loteId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw new AppError('Error al obtener trazabilidad: ' + error.message, 500)
    }

    return data
  }

  /**
   * Obtener movimientos del día actual (dashboard)
   */
  async getMovimientosHoy(sucursalId?: number): Promise<any[]> {
    let query = this.supabase.from('vista_movimientos_hoy').select('*')

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query

    if (error) {
      throw new AppError('Error al obtener movimientos de hoy: ' + error.message, 500)
    }

    return data ?? []
  }

  /**
   * Generar reporte de inventario valorizado
   */
  async getInventarioValorizado(sucursalId?: number): Promise<{
    totalProductos: number
    valorTotal: number
    valorVencimientoProximo: number
    productosStockBajo: number
  }> {
    let query = this.supabase.from('vista_stock_actual').select('*')

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data, error } = await query

    if (error) {
      throw new AppError('Error al generar reporte: ' + error.message, 500)
    }

    const stock = (data as StockActual[]) ?? []

    const valorTotal = stock.reduce((sum, item) => sum + (item.valor_inventario || 0), 0)

    const valorVencimientoProximo = stock.reduce((sum, item) => {
      if (item.fecha_vencimiento_proxima) {
        const dias = Math.ceil(
          (new Date(item.fecha_vencimiento_proxima).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        if (dias <= 30) {
          return sum + (item.valor_inventario || 0)
        }
      }
      return sum
    }, 0)

    return {
      totalProductos: stock.length,
      valorTotal,
      valorVencimientoProximo,
      productosStockBajo: 0, // TODO: Implementar comparación con stock mínimo
    }
  }

  /**
   * Validar integridad del Kardex (reconciliación)
   * Verifica que el stock calculado coincida con el stock real de los lotes
   */
  async validarIntegridad(sucursalId?: number): Promise<{
    ok: boolean
    discrepancias: Array<{
      productoId: number
      productoNombre: string
      stockCalculado: number
      stockReal: number
      diferencia: number
    }>
  }> {
    // Obtener stock según Kardex (último movimiento)
    const { data: kardexStock, error: error1 } = await this.supabase.rpc('get_stock_actual_from_kardex', {
      p_sucursal_id: sucursalId ?? null,
    })

    if (error1) {
      throw new AppError('Error al validar integridad: ' + error1.message, 500)
    }

    // Obtener stock real de lotes
    let query = this.supabase
      .from('lotes')
      .select('producto_id, productos(nombre_generico), cantidad_actual')
      .in('estado', ['ACTIVO', 'BLOQUEADO'])

    if (sucursalId) {
      query = query.eq('sucursal_id', sucursalId)
    }

    const { data: lotesStock, error: error2 } = await query

    if (error2) {
      throw new AppError('Error al obtener stock de lotes: ' + error2.message, 500)
    }

    // Comparar y encontrar discrepancias
    const discrepancias: Array<{
      productoId: number
      productoNombre: string
      stockCalculado: number
      stockReal: number
      diferencia: number
    }> = []

    // TODO: Implementar lógica de comparación

    return {
      ok: discrepancias.length === 0,
      discrepancias,
    }
  }
}
