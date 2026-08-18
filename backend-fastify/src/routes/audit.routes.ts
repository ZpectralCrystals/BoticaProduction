import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function auditRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as Record<string, string | undefined>
    const limite = Number(query.limite || 50)
    const accion = String(query.accion || '').trim()
    const tabla = String(query.tabla || '').trim()
    const desde = String(query.desde || '').trim()
    const hasta = String(query.hasta || '').trim()

    const conditions = ['1 = 1']
    const params: Array<string | number> = []

    if (accion) {
      params.push(accion)
      conditions.push(`a.caccion = $${params.length}`)
    }
    if (tabla) {
      params.push(tabla)
      conditions.push(`a.ctabla = $${params.length}`)
    }
    if (desde) {
      params.push(desde)
      conditions.push(`a.tcreado::DATE >= $${params.length}`)
    }
    if (hasta) {
      params.push(hasta)
      conditions.push(`a.tcreado::DATE <= $${params.length}`)
    }

    params.push(limite)

    const [itemsResult, resumenResult] = await Promise.all([
      fastify.db.query(
        `SELECT a.nid, a.cusuario, a.caccion, a.ctabla, a.nregistro_id, a.cdetalle, a.cip, a.tcreado::TEXT
         FROM bot_auditoria a
         WHERE ${conditions.join(' AND ')}
         ORDER BY a.tcreado DESC
         LIMIT $${params.length}`,
        params,
      ),
      fastify.db.query(
        `SELECT caccion, COUNT(*) AS n
         FROM bot_auditoria
         GROUP BY caccion
         ORDER BY n DESC`,
      ),
    ])

    return {
      total: itemsResult.rows.length,
      items: itemsResult.rows,
      resumen: resumenResult.rows,
    }
  })
}
