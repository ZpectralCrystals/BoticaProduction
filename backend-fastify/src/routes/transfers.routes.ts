import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function transfersRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { tipo?: string }
    const tipo = String(query.tipo || '').trim()
    const params: Array<string> = []
    let sql = `
      SELECT t.nid, t.ccodigo, t.ctipo, t.corigen, t.cdestino, t.cmotivo, t.cestado, t.tcreado::TEXT, u.cnombre AS usuario
      FROM bot_transferencias t
      LEFT JOIN bot_usuarios u ON u.nid = t.nusuario_id
      WHERE 1 = 1
    `
    if (tipo) {
      params.push(tipo)
      sql += ' AND t.ctipo = $1'
    }
    sql += ' ORDER BY t.tcreado DESC LIMIT 50'

    const result = await fastify.db.query(sql, params)
    const items = []
    for (const row of result.rows) {
      const detailResult = await fastify.db.query(
        `SELECT d.ncantidad, d.cnotas, p.cnombre AS producto
         FROM bot_transferencias_det d
         JOIN bot_productos p ON p.nid = d.nproducto_id
         WHERE d.ntransf_id = $1`,
        [row.nid],
      )
      items.push({ ...row, detalle: detailResult.rows })
    }
    return items
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      tipo?: string
      origen?: string
      destino?: string
      motivo?: string
      items?: Array<{ productoId?: number; cantidad?: number; notas?: string }>
    }

    const tipo = String(body.tipo || 'Transferencia').trim()
    const origen = String(body.origen || '').trim()
    const destino = String(body.destino || '').trim()
    const motivo = String(body.motivo || '').trim()
    const items = Array.isArray(body.items) ? body.items : []

    const client = await fastify.db.connect()
    try {
      const todayResult = await client.query<{ today: string }>('SELECT CURRENT_DATE::TEXT AS today')
      const today = (todayResult.rows[0]?.today || '').replace(/-/g, '')
      const countResult = await client.query<{ seq: string }>(
        'SELECT (COUNT(*) + 1)::text AS seq FROM bot_transferencias',
      )
      const codigo = `TRF-${today}-${String(Number(countResult.rows[0]?.seq || '1')).padStart(4, '0')}`

      await client.query('BEGIN')
      const transferResult = await client.query<{ nid: number }>(
        `INSERT INTO bot_transferencias (ccodigo, ctipo, corigen, cdestino, cmotivo, nusuario_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING nid`,
        [codigo, tipo, origen, destino, motivo, user.id],
      )
      const transferId = transferResult.rows[0]?.nid

      for (const item of items) {
        const productoId = Number(item.productoId || 0)
        const cantidad = Number(item.cantidad || 0)
        const notas = String(item.notas || '').trim()

        if (productoId <= 0 || cantidad <= 0) {
          await client.query('ROLLBACK')
          return reply.code(400).send({ error: 'ITEM DE TRANSFERENCIA INVALIDO' })
        }

        await client.query(
          `INSERT INTO bot_transferencias_det (ntransf_id, nproducto_id, ncantidad, cnotas)
           VALUES ($1, $2, $3, $4)`,
          [transferId, productoId, cantidad, notas],
        )

        if (['Transferencia', 'Merma'].includes(tipo)) {
          const stockResult = await client.query<{ cnombre: string; nstock: number }>(
            'SELECT cnombre, nstock FROM bot_productos WHERE nid = $1 FOR UPDATE',
            [productoId],
          )
          const stockRow = stockResult.rows[0]
          if (!stockRow) {
            await client.query('ROLLBACK')
            return reply.code(404).send({ error: 'PRODUCTO NO ENCONTRADO' })
          }
          if (Number(stockRow.nstock || 0) < cantidad) {
            await client.query('ROLLBACK')
            return reply.code(400).send({ error: `STOCK INSUFICIENTE PARA ${stockRow.cnombre.trim()}` })
          }
          await client.query(
            'UPDATE bot_productos SET nstock = nstock - $1, tmodifi = NOW() WHERE nid = $2',
            [cantidad, productoId],
          )
          await client.query(
            `INSERT INTO bot_kardex
             (nproducto_id, ctipo, cref_tabla, nref_id, ncantidad,
              nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario)
             VALUES ($1, $2, 'bot_transferencias', $3, $4, $5, $6, $7, $8, $9)`,
            [
              productoId,
              tipo.toUpperCase(),
              transferId,
              -cantidad,
              Number(stockRow.nstock),
              Number(stockRow.nstock) - cantidad,
              motivo || tipo,
              user.id,
              user.nombre,
            ],
          )
        } else if (['Entrada', 'Donacion', 'Regalo', 'Muestra'].includes(tipo)) {
          const stockPrevResult = await client.query<{ nstock: number }>(
            'SELECT nstock FROM bot_productos WHERE nid = $1 FOR UPDATE',
            [productoId],
          )
          const stockPrev = Number(stockPrevResult.rows[0]?.nstock ?? 0)

          await client.query(
            'UPDATE bot_productos SET nstock = nstock + $1, tmodifi = NOW() WHERE nid = $2',
            [cantidad, productoId],
          )
          await client.query(
            `INSERT INTO bot_kardex
             (nproducto_id, ctipo, cref_tabla, nref_id, ncantidad,
              nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario)
             VALUES ($1, $2, 'bot_transferencias', $3, $4, $5, $6, $7, $8, $9)`,
            [
              productoId,
              tipo.toUpperCase(),
              transferId,
              cantidad,
              stockPrev,
              stockPrev + cantidad,
              motivo || tipo,
              user.id,
              user.nombre,
            ],
          )
        }
      }

      await client.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, $3, 'bot_transferencias', $4, $5)`,
        [user.id, user.nombre, tipo, transferId, `${codigo}: ${motivo}`],
      )

      await client.query('COMMIT')
      return { ok: true, id: String(transferId), codigo }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}
