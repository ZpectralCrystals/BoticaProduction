import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { KardexService } from '../services/kardex.service.js'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'

/**
 * Schemas de validación
 */
const kardexFiltersSchema = z.object({
  productoId: z.coerce.number().optional(),
  loteId: z.coerce.number().optional(),
  sucursalId: z.coerce.number().optional(),
  tipoMovimiento: z.string().optional(),
  fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  documentoTipo: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const ajusteKardexSchema = z.object({
  tipoMovimientoCodigo: z.enum([
    'AJUSTE_POSITIVO',
    'AJUSTE_NEGATIVO',
    'MERMA',
    'DEVOLUCION_CLI',
    'DEVOLUCION_PROV',
    'TRANSFERENCIA_E',
    'TRANSFERENCIA_S',
  ]),
  productoId: z.number().positive(),
  loteId: z.number().positive(),
  sucursalId: z.number().positive(),
  cantidad: z.number().int().notEqual(0),
  costoUnitario: z.number().min(0).default(0),
  precioVenta: z.number().min(0).optional(),
  documentoTipo: z.string().default('AJUSTE'),
  documentoNumero: z.string().optional(),
  observaciones: z.string().optional(),
  motivoAjuste: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
})

const resumenQuerySchema = z.object({
  tipoMovimiento: z.string(),
  fechaDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sucursalId: z.coerce.number().optional(),
})

const stockHistoricoQuerySchema = z.object({
  productoId: z.coerce.number().positive(),
  sucursalId: z.coerce.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * Rutas del módulo Kardex
 */
export default async function kardexRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  const kardexService = new KardexService(fastify.supabase)

  // ==========================================
  // GET /kardex/stock-actual
  // ==========================================
  fastify.get(
    '/stock-actual',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener stock actual por producto y sucursal',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            sucursalId: { type: 'number' },
            productoId: { type: 'number' },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const { sucursalId, productoId, page, limit } = request.query as any

      const resultado = await kardexService.getStockActual(sucursalId, productoId, {
        page,
        limit,
      })

      return {
        success: true,
        data: resultado.stock,
        meta: {
          page,
          limit,
          total: resultado.total,
          totalPages: Math.ceil(resultado.total / limit),
        },
      }
    }
  )

  // ==========================================
  // GET /kardex/producto/:productoId/historial
  // ==========================================
  fastify.get(
    '/producto/:productoId/historial',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener historial Kardex de un producto',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            productoId: { type: 'number' },
          },
          required: ['productoId'],
        },
        querystring: {
          type: 'object',
          properties: {
            sucursalId: { type: 'number' },
            fechaDesde: { type: 'string', format: 'date' },
            fechaHasta: { type: 'string', format: 'date' },
          },
        },
      },
    },
    async (request, reply) => {
      const { productoId } = request.params as { productoId: string }
      const { sucursalId, fechaDesde, fechaHasta } = request.query as any

      const historial = await kardexService.getHistorialProducto(
        parseInt(productoId),
        sucursalId,
        fechaDesde,
        fechaHasta
      )

      return {
        success: true,
        data: historial,
        productoId: parseInt(productoId),
      }
    }
  )

  // ==========================================
  // GET /kardex/movimientos
  // ==========================================
  fastify.get(
    '/movimientos',
    {
      preHandler: authenticate,
      schema: {
        description: 'Buscar movimientos con filtros avanzados',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            productoId: { type: 'number' },
            loteId: { type: 'number' },
            sucursalId: { type: 'number' },
            tipoMovimiento: { type: 'string' },
            fechaDesde: { type: 'string', format: 'date' },
            fechaHasta: { type: 'string', format: 'date' },
            documentoTipo: { type: 'string' },
            limit: { type: 'number', default: 50 },
            offset: { type: 'number', default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const filters = kardexFiltersSchema.parse(request.query)

      const resultado = await kardexService.buscarMovimientos(filters)

      return {
        success: true,
        data: resultado.movimientos,
        meta: {
          limit: filters.limit,
          offset: filters.offset,
          total: resultado.total,
          hasMore: (filters.offset ?? 0) + (filters.limit ?? 50) < resultado.total,
        },
      }
    }
  )

  // ==========================================
  // GET /kardex/movimientos-hoy
  // ==========================================
  fastify.get(
    '/movimientos-hoy',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener movimientos del día actual',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            sucursalId: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sucursalId } = request.query as { sucursalId?: string }
      const movimientos = await kardexService.getMovimientosHoy(
        sucursalId ? parseInt(sucursalId) : undefined
      )

      return {
        success: true,
        data: movimientos,
        fecha: new Date().toISOString().split('T')[0],
      }
    }
  )

  // ==========================================
  // GET /kardex/resumen
  // ==========================================
  fastify.get(
    '/resumen',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener resumen de movimientos por tipo y período',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            tipoMovimiento: { type: 'string' },
            fechaDesde: { type: 'string', format: 'date' },
            fechaHasta: { type: 'string', format: 'date' },
            sucursalId: { type: 'number' },
          },
          required: ['tipoMovimiento', 'fechaDesde', 'fechaHasta'],
        },
      },
    },
    async (request, reply) => {
      const params = resumenQuerySchema.parse(request.query)

      const resumen = await kardexService.getResumenMovimientos(
        params.tipoMovimiento,
        params.fechaDesde,
        params.fechaHasta,
        params.sucursalId
      )

      return {
        success: true,
        data: resumen,
        periodo: {
          desde: params.fechaDesde,
          hasta: params.fechaHasta,
          tipoMovimiento: params.tipoMovimiento,
        },
      }
    }
  )

  // ==========================================
  // GET /kardex/stock-historico
  // ==========================================
  fastify.get(
    '/stock-historico',
    {
      preHandler: authenticate,
      schema: {
        description: 'Calcular stock histórico en una fecha específica',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            productoId: { type: 'number' },
            sucursalId: { type: 'number' },
            fecha: { type: 'string', format: 'date' },
          },
          required: ['productoId', 'sucursalId', 'fecha'],
        },
      },
    },
    async (request, reply) => {
      const params = stockHistoricoQuerySchema.parse(request.query)

      const stock = await kardexService.getStockHistorico(
        params.productoId,
        params.sucursalId,
        params.fecha
      )

      return {
        success: true,
        data: {
          productoId: params.productoId,
          sucursalId: params.sucursalId,
          fecha: params.fecha,
          stockHistorico: stock,
        },
      }
    }
  )

  // ==========================================
  // POST /kardex/movimiento
  // ==========================================
  fastify.post(
    '/movimiento',
    {
      preHandler: authenticate,
      schema: {
        description: 'Registrar movimiento manual en Kardex (ajuste, merma, etc.)',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['tipoMovimientoCodigo', 'productoId', 'loteId', 'sucursalId', 'cantidad', 'motivoAjuste'],
          properties: {
            tipoMovimientoCodigo: {
              type: 'string',
              enum: ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'MERMA', 'DEVOLUCION_CLI', 'DEVOLUCION_PROV', 'TRANSFERENCIA_E', 'TRANSFERENCIA_S'],
            },
            productoId: { type: 'number' },
            loteId: { type: 'number' },
            sucursalId: { type: 'number' },
            cantidad: { type: 'number' },
            costoUnitario: { type: 'number' },
            precioVenta: { type: 'number' },
            documentoTipo: { type: 'string' },
            documentoNumero: { type: 'string' },
            observaciones: { type: 'string' },
            motivoAjuste: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = ajusteKardexSchema.parse(request.body)

      // Generar número de documento si no se proporciona
      if (!body.documentoNumero) {
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
        body.documentoNumero = `${body.tipoMovimientoCodigo.substring(0, 3)}-${date}-${Date.now().toString(36).toUpperCase()}`
      }

      const kardexId = await kardexService.registrarMovimiento(
        body,
        request.user!.id,
        request.user!.email || request.user!.user_metadata?.nombre || 'Usuario'
      )

      return {
        success: true,
        data: {
          kardexId,
          documentoNumero: body.documentoNumero,
          mensaje: 'Movimiento registrado exitosamente',
        },
      }
    }
  )

  // ==========================================
  // GET /kardex/inventario-valorizado
  // ==========================================
  fastify.get(
    '/inventario-valorizado',
    {
      preHandler: authenticate,
      schema: {
        description: 'Obtener resumen de inventario valorizado',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            sucursalId: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sucursalId } = request.query as { sucursalId?: string }
      const reporte = await kardexService.getInventarioValorizado(
        sucursalId ? parseInt(sucursalId) : undefined
      )

      return {
        success: true,
        data: reporte,
      }
    }
  )

  // ==========================================
  // GET /kardex/validar-integridad
  // ==========================================
  fastify.get(
    '/validar-integridad',
    {
      preHandler: authenticate,
      schema: {
        description: 'Validar integridad del Kardex vs stock real',
        tags: ['kardex'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            sucursalId: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { sucursalId } = request.query as { sucursalId?: string }
      const resultado = await kardexService.validarIntegridad(
        sucursalId ? parseInt(sucursalId) : undefined
      )

      return {
        success: true,
        data: resultado,
      }
    }
  )
}
