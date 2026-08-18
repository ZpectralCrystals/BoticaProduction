import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function prescriptionsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const query = request.query as { pacienteId?: string; id?: string }

    if (query.pacienteId) {
      const pacienteId = Number(query.pacienteId)
      const result = await fastify.db.query(
        `SELECT r.nid, r.cfecha::TEXT, r.cdoctor, r.cdiagnostico, r.cindicaciones, r.cestado,
                m.cnombre AS medico_nombre
         FROM bot_recetas r
         LEFT JOIN bot_medicos m ON m.nid = r.nmedico_id
         WHERE r.npaciente_id = $1
         ORDER BY r.cfecha DESC`,
        [pacienteId],
      )

      const recetas = []
      for (const row of result.rows) {
        const detailResult = await fastify.db.query(
          `SELECT d.cmedicamento, d.cdosis, d.cfrecuencia, d.cduracion, d.cnotas,
                  COALESCE(p.cnombre,'') AS producto_nombre
           FROM bot_recetas_det d
           LEFT JOIN bot_productos p ON p.nid = d.nproducto_id
           WHERE d.nreceta_id = $1`,
          [row.nid],
        )
        recetas.push({ ...row, medicamentos: detailResult.rows })
      }

      return recetas
    }

    if (query.id) {
      const recetaId = Number(query.id)
      const result = await fastify.db.query(
        `SELECT r.*, m.cnombre AS medico_nombre, p.cnombre AS paciente_nombre
         FROM bot_recetas r
         LEFT JOIN bot_medicos m ON m.nid = r.nmedico_id
         LEFT JOIN bot_pacientes p ON p.nid = r.npaciente_id
         WHERE r.nid = $1`,
        [recetaId],
      )
      const receta = result.rows[0]
      if (!receta) return reply.code(404).send({ error: 'RECETA NO ENCONTRADA' })

      const detailResult = await fastify.db.query(
        `SELECT d.*, COALESCE(pr.cnombre,'') AS producto_nombre
         FROM bot_recetas_det d
         LEFT JOIN bot_productos pr ON pr.nid = d.nproducto_id
         WHERE d.nreceta_id = $1`,
        [recetaId],
      )

      return { ...receta, medicamentos: detailResult.rows }
    }

    return reply.code(400).send({ error: 'FALTA pacienteId o id' })
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      pacienteId?: number
      medicoId?: number
      historialId?: number
      doctor?: string
      fecha?: string
      diagnostico?: string
      indicaciones?: string
      medicamentos?: Array<{
        productoId?: number
        medicamento?: string
        dosis?: string
        frecuencia?: string
        duracion?: string
        notas?: string
      }>
    }

    const pacienteId = Number(body.pacienteId || 0)
    if (!pacienteId) return reply.code(400).send({ error: 'PACIENTE ES OBLIGATORIO' })

    const medicoId = Number(body.medicoId || 0)
    const historialId = Number(body.historialId || 0)
    const doctor = String(body.doctor || '').trim()
    const fecha = String(body.fecha || new Date().toISOString().slice(0, 10)).trim()
    const diagnostico = String(body.diagnostico || '').trim()
    const indicaciones = String(body.indicaciones || '').trim()
    const medicamentos = Array.isArray(body.medicamentos) ? body.medicamentos : []

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      const recetaResult = await client.query<{ nid: number }>(
        `INSERT INTO bot_recetas (npaciente_id, nmedico_id, nhistorial_id, cdoctor, cfecha, cdiagnostico, cindicaciones)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING nid`,
        [pacienteId, medicoId || null, historialId || null, doctor, fecha, diagnostico, indicaciones],
      )
      const recetaId = recetaResult.rows[0]?.nid

      for (const med of medicamentos) {
        await client.query(
          `INSERT INTO bot_recetas_det
           (nreceta_id, nproducto_id, cmedicamento, cdosis, cfrecuencia, cduracion, cnotas)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            recetaId,
            Number(med.productoId || 0) || null,
            String(med.medicamento || '').trim(),
            String(med.dosis || '').trim(),
            String(med.frecuencia || '').trim(),
            String(med.duracion || '').trim(),
            String(med.notas || '').trim(),
          ],
        )
      }

      await client.query('COMMIT')
      return { ok: true, id: String(recetaId) }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}
