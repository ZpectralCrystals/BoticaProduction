import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

function readText(value: unknown) {
  return String(value || '').trim()
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export default async function receptionRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['recepcion', 'compras'], {
      errorMessage: 'No tiene permisos para ver recepción',
    }))) return

    const result = await fastify.db.query(
      `SELECT r.nid, r.ccodigo, r.ncompra_id, r.cestado, r.cnotas, r.cincidencias,
              r.cusuario, r.tcreado::TEXT,
              c.ccodigo AS compra_codigo, c.cproveedor, c.cdocumento
       FROM bot_recepciones r
       LEFT JOIN bot_compras c ON c.nid = r.ncompra_id
       ORDER BY r.tcreado DESC
       LIMIT 100`,
    )

    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['recepcion'], {
      errorMessage: 'No tiene permisos para registrar recepción',
    }))) return

    const user = request.authUser
    const body = request.body as {
      compraId?: number
      notas?: string
      incidencias?: string
      items?: Array<{
        detalleId?: number
        productoId?: number
        cantidadEsperada?: number
        cantidadRecibida?: number
        incidencia?: string
      }>
    }
    const compraId = Number(body.compraId || 0)
    if (!compraId) return reply.code(400).send({ error: 'COMPRA ES OBLIGATORIA' })

    const compra = await fastify.db.query<{
      nid: number
      ccodigo: string
      nalmacen_id: number
    }>(
      "SELECT nid, ccodigo, nalmacen_id FROM bot_compras WHERE nid = $1 AND cestado <> 'I'",
      [compraId],
    )
    if (!compra.rows[0]) return reply.code(404).send({ error: 'COMPRA NO ENCONTRADA' })
    const almacenId = Number(compra.rows[0].nalmacen_id || 0)
    if (!almacenId) return reply.code(400).send({ error: 'COMPRA SIN ALMACEN DESTINO' })

    const detalle = await fastify.db.query<{
      nid: number
      nproducto_id: number
      ncantidad: string
      npreunit: string
      ccodigo_lote: string | null
      dfecha_vencimiento: string | null
      cnotas_lote: string | null
      producto_nombre: string
      lrequiere_lote: boolean | null
      lrequiere_vencimiento: boolean | null
    }>(
      `SELECT d.nid, d.nproducto_id, d.ncantidad, d.npreunit,
              d.ccodigo_lote, d.dfecha_vencimiento::TEXT, d.cnotas_lote,
              p.cnombre AS producto_nombre,
              COALESCE(p.lrequiere_lote, TRUE) AS lrequiere_lote,
              COALESCE(p.lrequiere_vencimiento, TRUE) AS lrequiere_vencimiento
       FROM bot_compras_det d
       JOIN bot_productos p ON p.nid = d.nproducto_id
       WHERE d.ncompra_id = $1
       ORDER BY d.nid`,
      [compraId],
    )
    if (detalle.rows.length === 0) return reply.code(400).send({ error: 'COMPRA SIN DETALLE' })
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return reply.code(400).send({ error: 'DEBE CONFIRMAR ITEMS RECIBIDOS' })
    }

    const prevReceipts = await fastify.db.query<{
      ncompra_det_id: number
      recibido: string
    }>(
      `SELECT rd.ncompra_det_id, COALESCE(SUM(rd.ncantidad_recibida), 0)::TEXT AS recibido
       FROM bot_recepcion_det rd
       JOIN bot_recepciones r ON r.nid = rd.nrecepcion_id
       WHERE r.ncompra_id = $1
         AND rd.ncompra_det_id IS NOT NULL
       GROUP BY rd.ncompra_det_id`,
      [compraId],
    )
    const prevMap = new Map(prevReceipts.rows.map(row => [Number(row.ncompra_det_id), Number(row.recibido || 0)]))
    const itemMap = new Map((body.items || []).map(item => [Number(item.detalleId || 0), item]))

    let hayMovimiento = false
    for (const row of detalle.rows) {
      const item = itemMap.get(Number(row.nid))
      if (!item) continue
      const esperado = Number(row.ncantidad || 0)
      const previo = prevMap.get(Number(row.nid)) || 0
      const pendiente = Math.max(0, esperado - previo)
      const recibido = Number(item.cantidadRecibida || 0)
      if (!Number.isFinite(recibido) || recibido < 0) return reply.code(400).send({ error: 'CANTIDAD RECIBIDA INVALIDA' })
      if (recibido > pendiente) {
        return reply.code(409).send({ error: `RECEPCION EXCEDE PENDIENTE PARA ${row.producto_nombre}` })
      }
      if (recibido > 0) hayMovimiento = true
      const lote = readText(row.ccodigo_lote)
      const vencimiento = readText(row.dfecha_vencimiento)
      if (recibido > 0 && row.lrequiere_lote !== false && !lote) {
        return reply.code(400).send({ error: `Producto ${row.producto_nombre} requiere lote para recepción` })
      }
      if (recibido > 0 && row.lrequiere_vencimiento !== false && !vencimiento) {
        return reply.code(400).send({ error: `Producto ${row.producto_nombre} requiere vencimiento para recepción` })
      }
      if (vencimiento && !isValidDateOnly(vencimiento)) {
        return reply.code(400).send({ error: 'FECHA DE VENCIMIENTO INVALIDA' })
      }
    }
    if (!hayMovimiento && !readText(body.incidencias)) {
      return reply.code(400).send({ error: 'SIN CANTIDADES NI INCIDENCIAS' })
    }

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')
      const today = (await client.query<{ today: string }>('SELECT CURRENT_DATE::TEXT AS today')).rows[0]?.today.replace(/-/g, '')
      const countResult = await client.query<{ total: string }>('SELECT COUNT(*)::TEXT AS total FROM bot_recepciones')
      const codigo = `REC-${today}-${String(Number(countResult.rows[0]?.total || '0') + 1).padStart(4, '0')}`

      const hasIncident = Boolean(readText(body.incidencias)) || (body.items || []).some(item => readText(item.incidencia))
      const allSubmittedFull = detalle.rows.every(row => {
        const item = itemMap.get(Number(row.nid))
        if (!item) return false
        const esperado = Number(row.ncantidad || 0)
        const previo = prevMap.get(Number(row.nid)) || 0
        const pendiente = Math.max(0, esperado - previo)
        return Number(item.cantidadRecibida || 0) === pendiente
      })
      const estadoRecepcion = allSubmittedFull && !hasIncident ? 'RECIBIDA' : 'PARCIAL'

      const inserted = await client.query<{ nid: number }>(
        `INSERT INTO bot_recepciones
           (ncompra_id, ccodigo, cestado, cnotas, cincidencias, nusuario_id, cusuario)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING nid`,
        [compraId, codigo, estadoRecepcion, readText(body.notas) || null, readText(body.incidencias) || null, user?.id ?? null, user?.nombre ?? null],
      )
      const recepcionId = inserted.rows[0].nid

      for (const row of detalle.rows) {
        const item = itemMap.get(Number(row.nid))
        if (!item) continue
        const productoId = Number(row.nproducto_id || 0)
        const cantidadEsperada = Number(row.ncantidad || 0)
        const cantidadRecibida = Number(item.cantidadRecibida || 0)
        const precioUnit = Number(row.npreunit || 0)
        const codigoLote = readText(row.ccodigo_lote) || null
        const fechaVencimiento = readText(row.dfecha_vencimiento) || null
        const incidencia = readText(item.incidencia)

        await client.query(
          `INSERT INTO bot_recepcion_det
             (nrecepcion_id, ncompra_det_id, nproducto_id, ncantidad_esperada, ncantidad_recibida, cincidencia)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            recepcionId,
            Number(row.nid),
            productoId,
            cantidadEsperada,
            cantidadRecibida,
            incidencia || null,
          ],
        )

        if (cantidadRecibida <= 0) continue

        const stockPrevResult = await client.query<{ nstock: number }>(
          'SELECT nstock FROM bot_productos WHERE nid = $1 FOR UPDATE',
          [productoId],
        )
        const stockPrev = Number(stockPrevResult.rows[0]?.nstock ?? 0)
        await client.query(
          `UPDATE bot_productos
           SET nstock = nstock + $1, nprecompra = $2, tmodifi = NOW()
           WHERE nid = $3`,
          [cantidadRecibida, precioUnit, productoId],
        )

        let loteId: number | null = null
        if (codigoLote) {
          const loteExistente = await client.query<{ nid: number }>(
            `SELECT nid FROM bot_lotes
             WHERE nproducto_id = $1 AND ccodigo_lote = $2 AND nalmacen_id = $3
             FOR UPDATE`,
            [productoId, codigoLote, almacenId],
          )
          if (loteExistente.rows.length > 0) {
            loteId = loteExistente.rows[0].nid
            await client.query(
              `UPDATE bot_lotes
               SET ncantidad = ncantidad + $1,
                   ncantidad_inicial = ncantidad_inicial + $1,
                   ncompra_id = $2,
                   nprecio_compra = $3,
                   tmodifi = NOW()
               WHERE nid = $4`,
              [cantidadRecibida, compraId, precioUnit, loteId],
            )
          } else {
            const insertedLote = await client.query<{ nid: number }>(
              `INSERT INTO bot_lotes
                 (nproducto_id, ncompra_id, ccodigo_lote, dfechavencimiento,
                  ncantidad, ncantidad_inicial, nprecio_compra, cestado, cnotas, nalmacen_id)
               VALUES ($1, $2, $3, $4::DATE, $5, $5, $6, 'ACTIVO', $7, $8)
               RETURNING nid`,
              [productoId, compraId, codigoLote, fechaVencimiento, cantidadRecibida, precioUnit, row.cnotas_lote, almacenId],
            )
            loteId = insertedLote.rows[0]?.nid ?? null
          }
        }

        await client.query(
          `INSERT INTO bot_kardex
             (nproducto_id, nlote_id, ctipo, cref_tabla, nref_id, ncantidad,
              nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
           VALUES ($1, $2, 'RECEPCION_COMPRA', 'bot_recepciones', $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            productoId,
            loteId,
            recepcionId,
            cantidadRecibida,
            stockPrev,
            stockPrev + cantidadRecibida,
            `Recepción ${codigo} de compra ${compra.rows[0].ccodigo}`,
            user?.id ?? null,
            user?.nombre ?? null,
            almacenId,
          ],
        )

        await client.query(
          `INSERT INTO bot_movimientos_almacen
             (nproducto_id, nlote_id, nalmacen_destino_id, ctipo_movimiento, ncantidad, cdetalle, nusuario_id, cusuario)
           VALUES ($1, $2, $3, 'COMPRA', $4, $5, $6, $7)`,
          [productoId, loteId, almacenId, cantidadRecibida, `Recepción ${codigo}`, user?.id ?? null, user?.nombre ?? null],
        )
      }

      await client.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'RECEPCION', 'bot_recepciones', $3, $4)`,
        [user?.id ?? null, user?.nombre ?? null, recepcionId, `Recepción ${codigo} de compra ${compra.rows[0].ccodigo}`],
      )

      await client.query('COMMIT')
      return { ok: true, id: String(recepcionId), codigo }
    } catch (error) {
      await client.query('ROLLBACK')
      request.log.error({ error }, 'Error registrando recepción')
      return reply.code(500).send({ error: 'No se pudo registrar recepción' })
    } finally {
      client.release()
    }
  })
}
