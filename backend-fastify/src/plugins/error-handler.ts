import { FastifyInstance, FastifyPluginAsync, FastifyError } from 'fastify'
import fp from 'fastify-plugin'

// Tipos de errores personalizados
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string | number) {
    super('NOT_FOUND', `${resource}${id ? ` ${id}` : ''} no encontrado`, 404)
    this.name = 'NotFoundError'
  }
}

export class InsufficientStockError extends AppError {
  constructor(
    public productoNombre: string,
    public solicitado: number,
    public disponible: number
  ) {
    super(
      'INSUFFICIENT_STOCK',
      `Stock insuficiente para ${productoNombre}. Solicitado: ${solicitado}, Disponible: ${disponible}`,
      400,
      { producto: productoNombre, solicitado, disponible }
    )
    this.name = 'InsufficientStockError'
  }
}

export class LotExpiredError extends AppError {
  constructor(public loteNumero: string, public fechaVencimiento: string) {
    super(
      'LOT_EXPIRED',
      `El lote ${loteNumero} venció el ${fechaVencimiento}`,
      400,
      { lote: loteNumero, fechaVencimiento }
    )
    this.name = 'LotExpiredError'
  }
}

const errorHandlerPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    request.log.error(error)

    // Errores personalizados de la aplicación
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
        details: error.details,
      })
    }

    // Errores de validación de Zod
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Datos de entrada inválidos',
        details: error,
      })
    }

    // Desalineación de esquema / migraciones faltantes
    if (error.code === '42703' || error.code === '42P01') {
      return reply.status(503).send({
        error: 'DATABASE_SCHEMA_ERROR',
        message:
          'La base de datos no está alineada con la versión actual del backend. Revise migraciones pendientes y columnas requeridas.',
        code: error.code,
      })
    }

    // Error de Supabase (PostgrestError)
    if (error.code?.startsWith('PGRST') || error.code?.startsWith('22') || error.code?.startsWith('23')) {
      return reply.status(400).send({
        error: 'DATABASE_ERROR',
        message: error.message,
        code: error.code,
      })
    }

    // Error genérico (no mostrar detalles en producción)
    const isDev = process.env.NODE_ENV === 'development'
    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: isDev ? error.message : 'Error interno del servidor',
      ...(isDev && { stack: error.stack }),
    })
  })

  // Not found handler
  fastify.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: 'NOT_FOUND',
      message: `Ruta ${request.url} no encontrada`,
    })
  })

  fastify.log.info('Error handler registered')
}

export default fp(errorHandlerPlugin, { name: 'error-handler' })
