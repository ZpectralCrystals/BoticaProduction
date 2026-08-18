import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function patientsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async () => {
    const result = await fastify.db.query<{
      nid: number
      cnombre: string
      cnrodni: string
      ctelefono: string | null
      nedad: number | null
      cnotas: string | null
      tultvisita: string | null
    }>(
      `SELECT nid, cnombre, cnrodni, ctelefono, nedad, cnotas, tultvisita::TEXT
       FROM bot_pacientes
       WHERE cestado = 'A'
         AND COALESCE(cesgenerico, 'N') = 'N'
       ORDER BY cnombre`,
    )

    return result.rows.map((row) => ({
      id: String(row.nid),
      fullName: row.cnombre.trim(),
      documentId: row.cnrodni.trim(),
      phone: String(row.ctelefono || '').trim(),
      age: Number(row.nedad || 0),
      notes: String(row.cnotas || '').trim(),
      lastVisit: row.tultvisita,
    }))
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      fullName?: string
      documentId?: string
      phone?: string
      age?: number
      notes?: string
    }

    const fullName = String(body.fullName || '').trim()
    const documentId = String(body.documentId || '').trim()
    const phone = String(body.phone || '').trim()
    const age = Number(body.age || 0)
    const notes = String(body.notes || '').trim()

    if (!fullName || !documentId) {
      return reply.code(400).send({ error: 'NOMBRE Y DNI SON REQUERIDOS' })
    }

    const result = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_pacientes (cnombre, cnrodni, ctelefono, nedad, cnotas)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cnrodni) DO UPDATE
       SET cnombre = EXCLUDED.cnombre,
           ctelefono = EXCLUDED.ctelefono,
           nedad = EXCLUDED.nedad,
           cnotas = EXCLUDED.cnotas,
           tultvisita = CURRENT_DATE
       RETURNING nid`,
      [fullName, documentId, phone, age, notes],
    )

    return { ok: true, id: String(result.rows[0]?.nid) }
  })
}
