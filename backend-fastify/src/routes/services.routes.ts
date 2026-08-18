import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function servicesRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async () => {
    const result = await fastify.db.query(
      `SELECT nid, cnombre, ccategoria, nprecio, cdescripcion
       FROM bot_servicios
       WHERE cestado = 'A'
       ORDER BY ccategoria, cnombre`,
    )
    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      id?: number
      nombre?: string
      categoria?: string
      precio?: number
      descripcion?: string
    }

    const nombre = String(body.nombre || '').trim()
    if (!nombre) return reply.code(400).send({ error: 'NOMBRE ES OBLIGATORIO' })

    const categoria = String(body.categoria || 'General').trim() || 'General'
    const precio = Number(body.precio || 0)
    const descripcion = String(body.descripcion || '').trim()

    const client = await fastify.db.connect()

    try {
      await client.query('BEGIN')

      if (body.id) {
        const duplicate = await client.query<{ nid: number }>(
          `SELECT nid
           FROM bot_servicios
           WHERE LOWER(BTRIM(cnombre)) = LOWER(BTRIM($1))
             AND LOWER(BTRIM(ccategoria)) = LOWER(BTRIM($2))
             AND nid <> $3
           ORDER BY nid
           LIMIT 1`,
          [nombre, categoria, body.id],
        )

        const targetId = duplicate.rows[0]?.nid ?? body.id
        await client.query(
          `UPDATE bot_servicios
           SET cnombre = $1, ccategoria = $2, nprecio = $3, cdescripcion = $4
           WHERE nid = $5`,
          [nombre, categoria, precio, descripcion, targetId],
        )

        if (duplicate.rows[0]?.nid && duplicate.rows[0].nid !== body.id) {
          await client.query(
            'UPDATE bot_ventas_det SET nservicio_id = $1 WHERE nservicio_id = $2',
            [targetId, body.id],
          )
          await client.query('DELETE FROM bot_servicios WHERE nid = $1', [body.id])
        }

        await client.query('COMMIT')
        return { ok: true, id: String(targetId) }
      }

      const existing = await client.query<{ nid: number }>(
        `SELECT nid
         FROM bot_servicios
         WHERE LOWER(BTRIM(cnombre)) = LOWER(BTRIM($1))
           AND LOWER(BTRIM(ccategoria)) = LOWER(BTRIM($2))
         ORDER BY nid
         LIMIT 1`,
        [nombre, categoria],
      )

      if (existing.rows[0]?.nid) {
        await client.query(
          `UPDATE bot_servicios
           SET nprecio = $1, cdescripcion = $2
           WHERE nid = $3`,
          [precio, descripcion, existing.rows[0].nid],
        )
        await client.query('COMMIT')
        return { ok: true, id: String(existing.rows[0].nid) }
      }

      const result = await client.query<{ nid: number }>(
        `INSERT INTO bot_servicios (cnombre, ccategoria, nprecio, cdescripcion)
         VALUES ($1, $2, $3, $4)
         RETURNING nid`,
        [nombre, categoria, precio, descripcion],
      )

      await client.query('COMMIT')
      return { ok: true, id: String(result.rows[0]?.nid) }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}
