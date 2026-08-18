import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify'

export default async function ajustesRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const MOTIVOS = new Set([
    'AJUSTE_CONTEO', 'MERMA', 'ROBO', 'VENCIMIENTO', 'ROTURA', 'CORRECCION_OPERATIVA',
  ])

  const handleAjusteInventario = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    if (!user.admin && !user.supervisor) {
      return reply.code(403).send({ error: 'Solo administradores o supervisores pueden realizar ajustes' })
    }

    const body = request.body as {
      productoId?: number | string
      almacenId?: number | string
      loteId?: number | string
      cantidad?: number | string
      motivo?: string
      detalle?: string
    }
    const productoId = Number(body.productoId || 0)
    const almacenId = Number(body.almacenId || 0)
    const loteId = Number(body.loteId || 0)
    const cantidad = Number(body.cantidad || 0)
    const motivo = String(body.motivo || '').trim().toUpperCase()
    const detalle = String(body.detalle || '').trim() || null

    if (!productoId || !almacenId || !loteId || !Number.isFinite(cantidad) || cantidad === 0 || !motivo) {
      return reply.code(400).send({ error: 'DATOS INVALIDOS' })
    }
    if (!MOTIVOS.has(motivo)) {
      return reply.code(400).send({ error: 'MOTIVO INVALIDO' })
    }

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      const loteRow = await client.query<{ ncantidad: number; nproducto_id: number }>(
        `SELECT ncantidad, nproducto_id FROM bot_lotes
         WHERE nid = $1 AND nalmacen_id = $2
         FOR UPDATE`,
        [loteId, almacenId],
      )
      const lote = loteRow.rows[0]
      if (!lote) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'LOTE NO ENCONTRADO' })
      }
      if (lote.nproducto_id !== productoId) {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'LOTE NO PERTENECE AL PRODUCTO INDICADO' })
      }

      const newLoteCantidad = Number(lote.ncantidad) + cantidad
      if (newLoteCantidad < 0) {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'STOCK INSUFICIENTE EN LOTE' })
      }

      const stockRow = await client.query<{ nstock: number }>(
        `SELECT nstock FROM bot_productos WHERE nid = $1 FOR UPDATE`,
        [productoId],
      )
      const stockPrev = Number(stockRow.rows[0]?.nstock ?? 0)
      const stockNew = stockPrev + cantidad
      if (stockNew < 0) {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'STOCK INSUFICIENTE EN PRODUCTO' })
      }

      await client.query(
        `UPDATE bot_lotes SET ncantidad = $1, tmodifi = NOW() WHERE nid = $2`,
        [newLoteCantidad, loteId],
      )

      await client.query(
        `UPDATE bot_productos SET nstock = $1, tmodifi = NOW() WHERE nid = $2`,
        [stockNew, productoId],
      )

      const motivoDetalle = detalle ? `${motivo}: ${detalle}` : motivo
      await client.query(
        `INSERT INTO bot_kardex
           (nproducto_id, nlote_id, nalmacen_id, ctipo, cref_tabla, nref_id,
            ncantidad, nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario)
         VALUES ($1, $2, $3, 'AJUSTE', 'bot_lotes', $2, $4, $5, $6, $7, $8, $9)`,
        [productoId, loteId, almacenId, cantidad, stockPrev, stockNew, motivoDetalle, user.id, user.nombre],
      )

      // Movimiento de almacén: entrada o salida según signo
      const tipoMov = cantidad >= 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA'
      const colAlmacen = cantidad >= 0 ? 'nalmacen_destino_id' : 'nalmacen_origen_id'
      await client.query(
        `INSERT INTO bot_movimientos_almacen
           (nproducto_id, nlote_id, ${colAlmacen}, ctipo_movimiento, ncantidad, cdetalle, nusuario_id, cusuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [productoId, loteId, almacenId, tipoMov, Math.abs(cantidad), motivoDetalle, user.id, user.nombre],
      )

      await client.query(
        `INSERT INTO bot_auditoria
           (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'AJUSTE_INVENTARIO', 'bot_lotes', $3, $4)`,
        [
          user.id, user.nombre, loteId,
          `Producto ${productoId} Lote ${loteId} Alm ${almacenId} Cant ${cantidad} Motivo ${motivo}`,
        ],
      )

      await client.query('COMMIT')
      return reply.code(200).send({ ok: true })
    } catch (error) {
      await client.query('ROLLBACK')
      request.log.error({ error }, 'Error en ajuste inventario')
      const message = error instanceof Error ? error.message : 'Error procesando ajuste'
      return reply.code(500).send({ error: 'AJUSTE_ERROR', message })
    } finally {
      client.release()
    }
  }

  // Official contract: POST /api/v1/ajustes. Keep /api/v1/ajustes/ajustes as legacy alias.
  fastify.post('/', { preHandler: fastify.requireAuth }, handleAjusteInventario)
  fastify.post('/ajustes', { preHandler: fastify.requireAuth }, handleAjusteInventario)
}
