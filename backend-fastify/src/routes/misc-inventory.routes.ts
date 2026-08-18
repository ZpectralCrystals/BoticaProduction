import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function miscInventoryRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async () => {
    const result = await fastify.db.query(
      `SELECT nid, cnombre, ccategoria, cdescripcion, ncantidad, nvalor, cubicacion, cestado, tcreado::TEXT
       FROM bot_inventario_var
       WHERE cestado IN ('A', 'P')
       ORDER BY ccategoria, cnombre`,
    )
    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      id?: number
      nombre?: string
      categoria?: string
      descripcion?: string
      cantidad?: number
      valor?: number
      ubicacion?: string
      estado?: string
    }

    const nombre = String(body.nombre || '').trim()
    if (!nombre) return reply.code(400).send({ error: 'NOMBRE ES OBLIGATORIO' })

    const categoria = String(body.categoria || '').trim()
    const descripcion = String(body.descripcion || '').trim()
    const cantidad = Number(body.cantidad || 1)
    const valor = Number(body.valor || 0)
    const ubicacion = String(body.ubicacion || '').trim()

    if (body.id) {
      await fastify.db.query(
        `UPDATE bot_inventario_var
         SET cnombre = $1, ccategoria = $2, cdescripcion = $3, ncantidad = $4, nvalor = $5, cubicacion = $6, cestado = $7
         WHERE nid = $8`,
        [nombre, categoria, descripcion, cantidad, valor, ubicacion, String(body.estado || 'A').trim(), body.id],
      )
      return { ok: true, id: String(body.id) }
    }

    const result = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_inventario_var (cnombre, ccategoria, cdescripcion, ncantidad, nvalor, cubicacion)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING nid`,
      [nombre, categoria, descripcion, cantidad, valor, ubicacion],
    )

    return { ok: true, id: String(result.rows[0]?.nid) }
  })
}
