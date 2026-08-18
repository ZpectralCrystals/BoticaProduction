import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import { checkSchema } from '../lib/schema-check.js'

export default async function systemRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  // GET /system/schema-status
  // Protected: only accessible to authenticated admin users
  // Returns full schema check result
  fastify.get('/schema-status', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    if (!user.admin && !user.super) {
      return reply.code(403).send({ error: 'Solo administradores pueden ver el estado del schema' })
    }

    try {
      const result = await checkSchema(fastify.db)
      return reply.code(result.ok ? 200 : 503).send({
        success: result.ok,
        ...result,
      })
    } catch (error) {
      fastify.log.error({ error }, 'schema-status check failed')
      return reply.code(500).send({
        success: false,
        ok: false,
        summary: 'No se pudo verificar el schema (error de base de datos)',
        error: error instanceof Error ? error.message : 'DB_ERROR',
      })
    }
  })
}
