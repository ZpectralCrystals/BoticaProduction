import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function doctorsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async () => {
    const result = await fastify.db.query(
      `SELECT nid, cnombre, ccmp, cespeciali, ctelefono, cemail, cnotas, tcreado::TEXT
       FROM bot_medicos
       WHERE cestado = 'A'
       ORDER BY cnombre`,
    )
    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      id?: number
      nombre?: string
      cmp?: string
      especialidad?: string
      telefono?: string
      email?: string
      notas?: string
    }

    const nombre = String(body.nombre || '').trim()
    if (!nombre) return reply.code(400).send({ error: 'NOMBRE ES OBLIGATORIO' })

    const cmp = String(body.cmp || '').trim()
    const especialidad = String(body.especialidad || '').trim()
    const telefono = String(body.telefono || '').trim()
    const email = String(body.email || '').trim()
    const notas = String(body.notas || '').trim()

    const client = await fastify.db.connect()

    try {
      await client.query('BEGIN')

      if (body.id) {
        const duplicate = await client.query<{ nid: number }>(
          cmp
            ? `SELECT nid
               FROM bot_medicos
               WHERE ccmp = $1 AND nid <> $2
               ORDER BY nid
               LIMIT 1`
            : `SELECT nid
               FROM bot_medicos
               WHERE LOWER(BTRIM(cnombre)) = LOWER(BTRIM($1)) AND nid <> $2
               ORDER BY nid
               LIMIT 1`,
          cmp ? [cmp, body.id] : [nombre, body.id],
        )

        const targetId = duplicate.rows[0]?.nid ?? body.id
        await client.query(
          `UPDATE bot_medicos
           SET cnombre = $1, ccmp = $2, cespeciali = $3, ctelefono = $4, cemail = $5, cnotas = $6
           WHERE nid = $7`,
          [nombre, cmp, especialidad, telefono, email, notas, targetId],
        )

        if (duplicate.rows[0]?.nid && duplicate.rows[0].nid !== body.id) {
          await client.query(
            'UPDATE bot_citas SET nmedico_id = $1 WHERE nmedico_id = $2',
            [targetId, body.id],
          )
          await client.query(
            'UPDATE bot_historial SET nmedico_id = $1 WHERE nmedico_id = $2',
            [targetId, body.id],
          )
          await client.query(
            'UPDATE bot_recetas SET nmedico_id = $1 WHERE nmedico_id = $2',
            [targetId, body.id],
          )
          await client.query('DELETE FROM bot_medicos WHERE nid = $1', [body.id])
        }

        await client.query('COMMIT')
        return { ok: true, id: String(targetId) }
      }

      const existing = await client.query<{ nid: number }>(
        cmp
          ? `SELECT nid
             FROM bot_medicos
             WHERE ccmp = $1
             ORDER BY nid
             LIMIT 1`
          : `SELECT nid
             FROM bot_medicos
             WHERE LOWER(BTRIM(cnombre)) = LOWER(BTRIM($1))
             ORDER BY nid
             LIMIT 1`,
        cmp ? [cmp] : [nombre],
      )

      if (existing.rows[0]?.nid) {
        await client.query(
          `UPDATE bot_medicos
           SET cnombre = $1, ccmp = $2, cespeciali = $3, ctelefono = $4, cemail = $5, cnotas = $6
           WHERE nid = $7`,
          [nombre, cmp, especialidad, telefono, email, notas, existing.rows[0].nid],
        )

        await client.query('COMMIT')
        return { ok: true, id: String(existing.rows[0].nid) }
      }

      const result = await client.query<{ nid: number }>(
        `INSERT INTO bot_medicos (cnombre, ccmp, cespeciali, ctelefono, cemail, cnotas)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING nid`,
        [nombre, cmp, especialidad, telefono, email, notas],
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
