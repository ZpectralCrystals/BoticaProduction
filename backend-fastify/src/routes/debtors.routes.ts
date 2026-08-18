import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function debtorsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { estado?: string }
    const estado = String(query.estado || '').trim()
    const values: Array<string> = []
    let sql = `
      SELECT nid, cnombre, cdni, ctelefono, cconcepto, nmonto, nabonado, (nmonto - nabonado) AS saldo, ffecha::TEXT, fvencimiento::TEXT, cnotas, cestado
      FROM bot_deudores
      WHERE 1 = 1
    `
    if (estado) {
      values.push(estado)
      sql += ' AND cestado = $1'
    }
    sql += ' ORDER BY cestado ASC, fvencimiento ASC NULLS LAST'

    const result = await fastify.db.query(sql, values)
    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      action?: string
      id?: number
      abono?: number
      nombre?: string
      dni?: string
      telefono?: string
      concepto?: string
      monto?: number
      fecha?: string
      vencimiento?: string
      notas?: string
    }

    if (body.action === 'abonar') {
      const id = Number(body.id || 0)
      const abono = Number(body.abono || 0)
      if (!id || abono <= 0) return reply.code(400).send({ error: 'ID Y ABONO SON OBLIGATORIOS' })

      await fastify.db.query('UPDATE bot_deudores SET nabonado = nabonado + $1 WHERE nid = $2', [abono, id])
      await fastify.db.query("UPDATE bot_deudores SET cestado = 'C' WHERE nid = $1 AND nabonado >= nmonto", [id])
      await fastify.db.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'ABONO', 'bot_deudores', $3, $4)`,
        [user.id, user.nombre, id, `Abono de S/${abono}`],
      )
      return { ok: true }
    }

    const nombre = String(body.nombre || '').trim()
    const concepto = String(body.concepto || '').trim()
    const monto = Number(body.monto || 0)
    if (!nombre || !concepto || monto <= 0) {
      return reply.code(400).send({ error: 'NOMBRE, CONCEPTO Y MONTO SON OBLIGATORIOS' })
    }

    const result = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_deudores (cnombre, cdni, ctelefono, cconcepto, nmonto, ffecha, fvencimiento, cnotas)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING nid`,
      [
        nombre,
        String(body.dni || '').trim(),
        String(body.telefono || '').trim(),
        concepto,
        monto,
        String(body.fecha || new Date().toISOString().slice(0, 10)).trim(),
        String(body.vencimiento || '').trim() || null,
        String(body.notas || '').trim(),
      ],
    )

    return { ok: true, id: String(result.rows[0]?.nid) }
  })
}
