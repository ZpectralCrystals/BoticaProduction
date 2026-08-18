import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

function mapKardexRow(row: any) {
  return {
    id: row.nid,
    productoId: row.nproducto_id,
    productoNombre: String(row.producto_nombre || '').trim(),
    productoCodigo: String(row.producto_codigo || '').trim(),
    tipo: row.ctipo,
    refTabla: row.cref_tabla,
    refId: row.nref_id,
    loteId: row.nlote_id ?? null,
    codigoLote: row.ccodigo_lote ?? null,
    cantidad: row.ncantidad,
    stockAnterior: row.nstock_anterior,
    stockNuevo: row.nstock_nuevo,
    detalle: row.cdetalle,
    usuarioId: row.nusuario_id,
    usuario: String(row.cusuario || '').trim(),
    fecha: row.tcreado,
  }
}

const KARDEX_SELECT = `
  SELECT
    k.nid,
    k.nproducto_id,
    p.cnombre    AS producto_nombre,
    p.ccodigo    AS producto_codigo,
    k.ctipo,
    k.cref_tabla,
    k.nref_id,
    k.nlote_id,
    k.ccodigo_lote,
    k.ncantidad,
    k.nstock_anterior,
    k.nstock_nuevo,
    k.cdetalle,
    k.nusuario_id,
    k.cusuario,
    k.tcreado::TEXT AS tcreado
  FROM bot_kardex k
  LEFT JOIN bot_productos p ON p.nid = k.nproducto_id`

export default async function kardexRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  // ── GET /kardex ─────────────────────────────────────────────
  // Query params: producto_id, tipo, desde, hasta, ref_tabla, ref_id, limit, offset
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const q = request.query as {
      producto_id?: string
      tipo?: string
      desde?: string
      hasta?: string
      ref_tabla?: string
      ref_id?: string
      limit?: string
      offset?: string
    }

    const productoId = q.producto_id ? Number(q.producto_id) : null
    const tipo = q.tipo?.trim().toUpperCase() || null
    const desde = q.desde?.trim() || null
    const hasta = q.hasta?.trim() || null
    const refTabla = q.ref_tabla?.trim() || null
    const refId = q.ref_id ? Number(q.ref_id) : null
    const limit = Math.min(Number(q.limit || 100), 500)
    const offset = Math.max(Number(q.offset || 0), 0)

    const conditions: string[] = []
    const params: unknown[] = []

    if (productoId) {
      params.push(productoId)
      conditions.push(`k.nproducto_id = $${params.length}`)
    }
    if (tipo) {
      params.push(tipo)
      conditions.push(`k.ctipo = $${params.length}`)
    }
    if (desde) {
      params.push(desde)
      conditions.push(`k.tcreado >= $${params.length}::TIMESTAMP`)
    }
    if (hasta) {
      params.push(hasta)
      conditions.push(`k.tcreado <= ($${params.length}::TIMESTAMP + INTERVAL '1 day' - INTERVAL '1 second')`)
    }
    if (refTabla) {
      params.push(refTabla)
      conditions.push(`k.cref_tabla = $${params.length}`)
    }
    if (refId) {
      params.push(refId)
      conditions.push(`k.nref_id = $${params.length}`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // total count (same filters, without limit/offset)
    const countParams = [...params]
    params.push(limit)
    params.push(offset)

    try {
      const [countResult, rowsResult] = await Promise.all([
        fastify.db.query<{ total: string }>(
          `SELECT COUNT(*)::TEXT AS total FROM bot_kardex k ${where}`,
          countParams,
        ),
        fastify.db.query(
          `${KARDEX_SELECT}
           ${where}
           ORDER BY k.tcreado DESC, k.nid DESC
           LIMIT $${params.length - 1} OFFSET $${params.length}`,
          params,
        ),
      ])

      return {
        success: true,
        total: Number(countResult.rows[0]?.total ?? 0),
        limit,
        offset,
        data: rowsResult.rows.map(mapKardexRow),
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ success: false, error: 'Error al consultar el Kardex' })
    }
  })

  // ── GET /kardex/:id ─────────────────────────────────────────
  fastify.get('/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const kardexId = Number(id)

    if (!kardexId || kardexId <= 0) {
      return reply.code(400).send({ success: false, error: 'ID de movimiento inválido' })
    }

    try {
      const { rows } = await fastify.db.query(
        `${KARDEX_SELECT} WHERE k.nid = $1`,
        [kardexId],
      )

      if (rows.length === 0) {
        return reply.code(404).send({ success: false, error: 'Movimiento de Kardex no encontrado' })
      }

      return { success: true, data: mapKardexRow(rows[0]) }
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ success: false, error: 'Error al obtener el movimiento' })
    }
  })

  // ── POST /kardex/ajuste ─────────────────────────────────────
  // Ajuste manual de inventario (solo administradores).
  // cantidad positiva = entrada  /  cantidad negativa = salida
  fastify.post('/ajuste', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ success: false, error: 'NO HA INICIADO SESION' })
    if (!user.admin && !user.super) {
      return reply.code(403).send({ success: false, error: 'Solo administradores pueden realizar ajustes de inventario' })
    }

    const body = request.body as {
      productoId?: number
      cantidad?: number
      motivo?: string
    }

    const productoId = Number(body?.productoId || 0)
    const cantidad = Number(body?.cantidad ?? 0)
    const motivo = String(body?.motivo || '').trim()

    if (!productoId || productoId <= 0) {
      return reply.code(400).send({ success: false, error: 'productoId inválido' })
    }
    if (cantidad === 0) {
      return reply.code(400).send({ success: false, error: 'La cantidad del ajuste no puede ser 0' })
    }
    if (!motivo) {
      return reply.code(400).send({ success: false, error: 'El motivo del ajuste es obligatorio' })
    }

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      const productoResult = await client.query<{
        nid: number
        cnombre: string
        nstock: number
        lrequiere_lote?: boolean | null
      }>(
        `SELECT nid, cnombre, nstock, COALESCE(lrequiere_lote, FALSE) AS lrequiere_lote
         FROM bot_productos
         WHERE nid = $1
         FOR UPDATE`,
        [productoId],
      )
      const producto = productoResult.rows[0]

      if (!producto) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ success: false, error: 'Producto no encontrado' })
      }
      if (producto.lrequiere_lote === true) {
        await client.query('ROLLBACK')
        return reply.code(400).send({
          success: false,
          error: 'AJUSTE REQUIERE LOTE. Use /api/v1/ajustes con loteId y almacenId.',
        })
      }

      const stockAnterior = Number(producto.nstock)
      const stockNuevo = stockAnterior + cantidad

      if (stockNuevo < 0) {
        await client.query('ROLLBACK')
        return reply.code(400).send({
          success: false,
          error: `El ajuste dejaría el stock en ${stockNuevo}. El stock no puede ser negativo.`,
        })
      }

      await client.query(
        'UPDATE bot_productos SET nstock = $1, tmodifi = NOW() WHERE nid = $2',
        [stockNuevo, productoId],
      )

      const kardexResult = await client.query<{ nid: number }>(
        `INSERT INTO bot_kardex
         (nproducto_id, ctipo, cref_tabla, ncantidad,
          nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario)
         VALUES ($1, 'AJUSTE', 'bot_kardex', $2, $3, $4, $5, $6, $7)
         RETURNING nid`,
        [
          productoId,
          cantidad,
          stockAnterior,
          stockNuevo,
          motivo,
          user.id,
          user.nombre,
        ],
      )

      await client.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'AJUSTE_INVENTARIO', 'bot_kardex', $3, $4)`,
        [
          user.id,
          user.nombre,
          kardexResult.rows[0].nid,
          `Ajuste ${cantidad > 0 ? '+' : ''}${cantidad} u. de "${producto.cnombre.trim()}" — ${motivo}`,
        ],
      )

      await client.query('COMMIT')

      return {
        success: true,
        kardexId: kardexResult.rows[0].nid,
        productoId,
        productoNombre: producto.cnombre.trim(),
        cantidad,
        stockAnterior,
        stockNuevo,
        motivo,
      }
    } catch (error) {
      await client.query('ROLLBACK')
      request.log.error(error)
      return reply.code(500).send({ success: false, error: 'Error al registrar el ajuste' })
    } finally {
      client.release()
    }
  })

  // GET /kardex/resumen/:productoId — resumen de movimientos de un producto
  fastify.get('/resumen/:productoId', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { productoId } = request.params as { productoId: string }
    const id = Number(productoId)

    if (!id || id <= 0) {
      return reply.code(400).send({ success: false, error: 'productoId inválido' })
    }

    try {
      const [productoResult, movimientosResult, stockActualResult] = await Promise.all([
        fastify.db.query<{ cnombre: string; ccodigo: string; nstock: number }>(
          'SELECT cnombre, ccodigo, nstock FROM bot_productos WHERE nid = $1',
          [id],
        ),
        fastify.db.query(
          `SELECT
             ctipo,
             COUNT(*)::INT           AS cantidad_movimientos,
             SUM(ncantidad)::INT     AS unidades_neto,
             MIN(tcreado)::TEXT      AS primer_movimiento,
             MAX(tcreado)::TEXT      AS ultimo_movimiento
           FROM bot_kardex
           WHERE nproducto_id = $1
           GROUP BY ctipo
           ORDER BY ctipo`,
          [id],
        ),
        fastify.db.query<{ nstock: number }>(
          'SELECT nstock FROM bot_productos WHERE nid = $1',
          [id],
        ),
      ])

      const producto = productoResult.rows[0]
      if (!producto) {
        return reply.code(404).send({ success: false, error: 'Producto no encontrado' })
      }

      return {
        success: true,
        data: {
          productoId: id,
          productoNombre: producto.cnombre.trim(),
          productoCodigo: producto.ccodigo.trim(),
          stockActual: Number(stockActualResult.rows[0]?.nstock ?? 0),
          resumenPorTipo: movimientosResult.rows.map((row: any) => ({
            tipo: row.ctipo,
            cantidadMovimientos: row.cantidad_movimientos,
            unidadesNeto: row.unidades_neto,
            primerMovimiento: row.primer_movimiento,
            ultimoMovimiento: row.ultimo_movimiento,
          })),
        },
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ success: false, error: 'Error al obtener resumen del Kardex' })
    }
  })
}
