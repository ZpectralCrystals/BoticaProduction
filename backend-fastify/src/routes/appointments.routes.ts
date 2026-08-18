import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function appointmentsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async () => {
    const result = await fastify.db.query<{
      nid: number
      cpaciente: string
      cdoctor: string
      cespeciali: string | null
      csala: string | null
      tinicio: string
      cestado: string
    }>(
      `SELECT nid, cpaciente, cdoctor, cespeciali, csala, tinicio::TEXT, cestado
       FROM bot_citas
       ORDER BY tinicio`,
    )

    return result.rows.map((row) => ({
      id: String(row.nid),
      patient: row.cpaciente.trim(),
      doctor: row.cdoctor.trim(),
      specialty: String(row.cespeciali || '').trim(),
      room: String(row.csala || '').trim(),
      startsAt: row.tinicio,
      status: row.cestado.trim(),
    }))
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      patient?: string
      doctor?: string
      specialty?: string
      room?: string
      startsAt?: string
      status?: string
    }

    const patient = String(body.patient || '').trim()
    const doctor = String(body.doctor || '').trim()
    const specialty = String(body.specialty || '').trim()
    const room = String(body.room || '').trim()
    const startsAt = String(body.startsAt || '').trim()
    const status = String(body.status || 'Confirmada').trim() || 'Confirmada'

    if (!patient || !doctor || !startsAt) {
      return reply.code(400).send({ error: 'PACIENTE, DOCTOR Y FECHA SON REQUERIDOS' })
    }

    const result = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_citas (cpaciente, cdoctor, cespeciali, csala, tinicio, cestado)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING nid`,
      [patient, doctor, specialty, room, startsAt, status],
    )

    return { ok: true, id: String(result.rows[0]?.nid) }
  })
}
