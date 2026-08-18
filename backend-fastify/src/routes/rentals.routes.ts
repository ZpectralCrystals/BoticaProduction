import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function rentalsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async () => {
    const result = await fastify.db.query(
      `SELECT nid, cconcepto, carrendatario, cdni, ctelefono, nperiodo_monto, cperiodo, finicio::TEXT, ffin::TEXT, cnotas, cestado, tcreado::TEXT
       FROM bot_alquileres
       ORDER BY cestado ASC, tcreado DESC`,
    )
    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      id?: number
      concepto?: string
      arrendatario?: string
      dni?: string
      telefono?: string
      monto?: number
      periodo?: string
      inicio?: string
      fin?: string
      notas?: string
      estado?: string
    }

    const concepto = String(body.concepto || '').trim()
    if (!concepto) return reply.code(400).send({ error: 'CONCEPTO ES OBLIGATORIO' })

    const arrendatario = String(body.arrendatario || '').trim()
    const dni = String(body.dni || '').trim()
    const telefono = String(body.telefono || '').trim()
    const monto = Number(body.monto || 0)
    const periodo = String(body.periodo || 'Mensual').trim() || 'Mensual'
    const inicio = String(body.inicio || '').trim()
    const fin = String(body.fin || '').trim()
    const notas = String(body.notas || '').trim()

    if (body.id) {
      await fastify.db.query(
        `UPDATE bot_alquileres
         SET cconcepto = $1, carrendatario = $2, cdni = $3, ctelefono = $4,
             nperiodo_monto = $5, cperiodo = $6, finicio = $7, ffin = $8, cnotas = $9, cestado = $10
         WHERE nid = $11`,
        [
          concepto,
          arrendatario,
          dni,
          telefono,
          monto,
          periodo,
          inicio || null,
          fin || null,
          notas,
          String(body.estado || 'A').trim() || 'A',
          body.id,
        ],
      )
      return { ok: true, id: String(body.id) }
    }

    const result = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_alquileres
       (cconcepto, carrendatario, cdni, ctelefono, nperiodo_monto, cperiodo, finicio, ffin, cnotas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING nid`,
      [concepto, arrendatario, dni, telefono, monto, periodo, inicio || null, fin || null, notas],
    )

    return { ok: true, id: String(result.rows[0]?.nid) }
  })
}
