import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function historiesRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const query = request.query as { pacienteId?: string }
    const pacienteId = Number(query.pacienteId || 0)
    if (!pacienteId) return reply.code(400).send({ error: 'FALTA pacienteId' })

    const result = await fastify.db.query(
      `SELECT h.nid, h.cfecha::TEXT, h.cdoctor, h.cdiagnostico, h.ctratamiento, h.cobservacion, h.csignos,
              m.cnombre AS medico_nombre, m.cespeciali
       FROM bot_historial h
       LEFT JOIN bot_medicos m ON m.nid = h.nmedico_id
       WHERE h.npaciente_id = $1
       ORDER BY h.cfecha DESC`,
      [pacienteId],
    )

    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      pacienteId?: number
      medicoId?: number
      doctor?: string
      fecha?: string
      diagnostico?: string
      tratamiento?: string
      observacion?: string
      signos?: string
    }

    const pacienteId = Number(body.pacienteId || 0)
    if (!pacienteId) return reply.code(400).send({ error: 'PACIENTE ES OBLIGATORIO' })

    const medicoId = Number(body.medicoId || 0)
    const doctor = String(body.doctor || '').trim()
    const fecha = String(body.fecha || new Date().toISOString().slice(0, 10)).trim()
    const diagnostico = String(body.diagnostico || '').trim()
    const tratamiento = String(body.tratamiento || '').trim()
    const observacion = String(body.observacion || '').trim()
    const signos = String(body.signos || '').trim()

    const result = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_historial
       (npaciente_id, nmedico_id, cdoctor, cfecha, cdiagnostico, ctratamiento, cobservacion, csignos)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING nid`,
      [pacienteId, medicoId || null, doctor, fecha, diagnostico, tratamiento, observacion, signos],
    )

    const historialId = result.rows[0]?.nid

    await fastify.db.query('UPDATE bot_pacientes SET tultvisita = $1 WHERE nid = $2', [fecha, pacienteId])
    await fastify.db.query(
      `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
       VALUES ($1, $2, 'HISTORIAL', 'bot_historial', $3, $4)`,
      [user.id, user.nombre, historialId, `Registro clinico paciente ${pacienteId}`],
    )

    return { ok: true, id: String(historialId) }
  })
}
