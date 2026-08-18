import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function lotesRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  // ──────────────────────────────────────────────────────────
  // GET /lotes — Listar lotes con filtros opcionales
  // Query: producto_id, estado, vence_antes, vence_despues, limit
  // ──────────────────────────────────────────────────────────
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const q = request.query as {
      producto_id?: string
      estado?: string
      vence_antes?: string
      vence_despues?: string
      limit?: string
    }

    const conditions: string[] = []
    const params: unknown[] = []

    if (q.producto_id) {
      params.push(Number(q.producto_id))
      conditions.push(`l.nproducto_id = $${params.length}`)
    }
    if (q.estado) {
      params.push(q.estado.trim().toUpperCase())
      conditions.push(`l.cestado = $${params.length}`)
    }
    if (q.vence_antes) {
      params.push(q.vence_antes.trim())
      conditions.push(`l.dfechavencimiento <= $${params.length}::DATE`)
    }
    if (q.vence_despues) {
      params.push(q.vence_despues.trim())
      conditions.push(`l.dfechavencimiento >= $${params.length}::DATE`)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit = Math.min(Number(q.limit || 100), 500)
    params.push(limit)

    try {
      const { rows } = await fastify.db.query(
        `SELECT
           l.nid,
           l.nproducto_id,
           p.cnombre                             AS producto_nombre,
           p.ccodigo                             AS producto_codigo,
           l.ncompra_id,
           l.ccodigo_lote,
           l.dfechavencimiento::TEXT             AS fecha_vencimiento,
           l.ncantidad,
           l.ncantidad_inicial,
           l.cestado,
           l.cnotas,
           l.nversion,
           l.tcreado::TEXT                       AS tcreado,
           (l.dfechavencimiento - CURRENT_DATE)  AS dias_para_vencer
         FROM bot_lotes l
         LEFT JOIN bot_productos p ON p.nid = l.nproducto_id
         ${where}
         ORDER BY l.dfechavencimiento ASC, l.nproducto_id, l.tcreado ASC
         LIMIT $${params.length}`,
        params,
      )

      return {
        success: true,
        total: rows.length,
        data: rows.map((row: Record<string, unknown>) => ({
          id: Number(row.nid),
          productoId: Number(row.nproducto_id),
          productoNombre: String(row.producto_nombre ?? '').trim(),
          productoCodigo: String(row.producto_codigo ?? '').trim(),
          compraId: row.ncompra_id ? Number(row.ncompra_id) : null,
          codigoLote: row.ccodigo_lote ? String(row.ccodigo_lote) : null,
          fechaVencimiento: String(row.fecha_vencimiento ?? ''),
          cantidad: Number(row.ncantidad ?? 0),
          cantidadInicial: Number(row.ncantidad_inicial ?? 0),
          estado: String(row.cestado ?? 'ACTIVO'),
          notas: row.cnotas ? String(row.cnotas) : null,
          diasParaVencer: row.dias_para_vencer !== null ? Number(row.dias_para_vencer) : null,
          tcreado: String(row.tcreado ?? ''),
        })),
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ success: false, error: 'Error al consultar lotes' })
    }
  })

  // ──────────────────────────────────────────────────────────
  // GET /lotes/disponibles/:productoId — Todos los lotes vigentes FEFO
  // Útil para el frontend y para planificación de venta
  // ──────────────────────────────────────────────────────────
  fastify.get('/disponibles/:productoId', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { productoId } = request.params as { productoId: string }
    const qs = request.query as { soloVendible?: string; soloClinico?: string; almacenId?: string }
    const id = Number(productoId)

    if (!id || id <= 0) {
      return reply.code(400).send({ success: false, error: 'productoId inválido' })
    }

    // Build almacen filter for FEFO
    const almExtraConds: string[] = []
    const almParams: unknown[] = [id]
    if (qs.almacenId) {
      almParams.push(Number(qs.almacenId))
      almExtraConds.push(`AND l.nalmacen_id = $${almParams.length}`)
    }
    if (qs.soloVendible === 'true') {
      almExtraConds.push(`AND (a.bpermite_venta = TRUE)`)
    }
    if (qs.soloClinico === 'true') {
      almExtraConds.push(`AND (a.bpermite_consumo_clinico = TRUE)`)
    }

    try {
      const [productoResult, lotesResult] = await Promise.all([
        fastify.db.query<{ cnombre: string; ccodigo: string; nstock: number }>(
          'SELECT cnombre, ccodigo, nstock FROM bot_productos WHERE nid = $1 AND cestado = $2',
          [id, 'A'],
        ),
        fastify.db.query(
          `SELECT
             l.nid,
             l.ccodigo_lote,
             l.dfechavencimiento::TEXT             AS fecha_vencimiento,
             l.ncantidad,
             l.ncantidad_inicial,
             l.nalmacen_id,
             a.cnombre                             AS almacen_nombre,
             (l.dfechavencimiento - CURRENT_DATE)  AS dias_para_vencer,
             CASE
               WHEN (l.dfechavencimiento - CURRENT_DATE) <= 30 THEN 'CRITICO'
               WHEN (l.dfechavencimiento - CURRENT_DATE) <= 90 THEN 'PROXIMO'
               ELSE 'OK'
             END                                   AS alerta
           FROM bot_lotes l
           LEFT JOIN bot_almacenes a ON a.nid = l.nalmacen_id
           WHERE l.nproducto_id = $1
             AND l.cestado = 'ACTIVO'
             AND l.ncantidad > 0
             AND l.dfechavencimiento >= CURRENT_DATE
             ${almExtraConds.join(' ')}
           ORDER BY l.dfechavencimiento ASC, l.tcreado ASC`,
          almParams,
        ),
      ])

      const producto = productoResult.rows[0]
      if (!producto) {
        return reply.code(404).send({ success: false, error: 'Producto no encontrado o inactivo' })
      }

      const lotes = lotesResult.rows as Record<string, unknown>[]
      const totalEnLotes = lotes.reduce((s, l) => s + Number(l.ncantidad ?? 0), 0)

      let acumulado = 0
      const data = lotes.map((l) => {
        acumulado += Number(l.ncantidad ?? 0)
        return {
          id: Number(l.nid),
          codigoLote: l.ccodigo_lote ? String(l.ccodigo_lote) : null,
          fechaVencimiento: String(l.fecha_vencimiento ?? ''),
          cantidad: Number(l.ncantidad ?? 0),
          cantidadInicial: Number(l.ncantidad_inicial ?? 0),
          diasParaVencer: Number(l.dias_para_vencer ?? 0),
          alerta: String(l.alerta ?? 'OK'),
          stockAcumulado: acumulado,
        }
      })

      return {
        success: true,
        data: {
          productoId: id,
          productoNombre: String(producto.cnombre).trim(),
          productoCodigo: String(producto.ccodigo).trim(),
          stockTotal: Number(producto.nstock),
          stockEnLotes: totalEnLotes,
          stockSinLote: Number(producto.nstock) - totalEnLotes,
          tieneLottes: lotes.length > 0,
          lotes: data,
        },
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ success: false, error: 'Error al consultar lotes disponibles' })
    }
  })

  // ──────────────────────────────────────────────────────────
  // GET /lotes/fefo/:productoId — Próximo lote FEFO (primero en vencer)
  // Usado para preparar selección de lote en ventas futuras
  // ──────────────────────────────────────────────────────────
  fastify.get('/fefo/:productoId', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const { productoId } = request.params as { productoId: string }
    const id = Number(productoId)

    if (!id || id <= 0) {
      return reply.code(400).send({ success: false, error: 'productoId inválido' })
    }

    try {
      const [productoResult, loteResult, todosResult] = await Promise.all([
        fastify.db.query<{ cnombre: string; ccodigo: string; nstock: number }>(
          'SELECT cnombre, ccodigo, nstock FROM bot_productos WHERE nid = $1',
          [id],
        ),
        fastify.db.query(
          `SELECT
             l.nid,
             l.ccodigo_lote,
             l.dfechavencimiento::TEXT             AS fecha_vencimiento,
             l.ncantidad,
             l.cestado,
             (l.dfechavencimiento - CURRENT_DATE)  AS dias_para_vencer
           FROM bot_lotes l
           WHERE l.nproducto_id = $1
             AND l.cestado = 'ACTIVO'
             AND l.ncantidad > 0
             AND l.dfechavencimiento >= CURRENT_DATE
           ORDER BY l.dfechavencimiento ASC, l.tcreado ASC
           LIMIT 1`,
          [id],
        ),
        fastify.db.query(
          `SELECT
             cestado,
             COUNT(*)::INT         AS cantidad_lotes,
             SUM(ncantidad)::INT   AS total_unidades
           FROM bot_lotes
           WHERE nproducto_id = $1
           GROUP BY cestado`,
          [id],
        ),
      ])

      const producto = productoResult.rows[0]
      if (!producto) {
        return reply.code(404).send({ success: false, error: 'Producto no encontrado' })
      }

      const loteFefo = loteResult.rows[0] as Record<string, unknown> | undefined
      const resumenEstados: Record<string, { lotes: number; unidades: number }> = {}
      for (const row of todosResult.rows as Record<string, unknown>[]) {
        resumenEstados[String(row.cestado)] = {
          lotes: Number(row.cantidad_lotes),
          unidades: Number(row.total_unidades),
        }
      }

      return {
        success: true,
        data: {
          productoId: id,
          productoNombre: producto.cnombre.trim(),
          productoCodigo: producto.ccodigo.trim(),
          stockActual: Number(producto.nstock),
          loteFefo: loteFefo
            ? {
                id: Number(loteFefo.nid),
                codigoLote: loteFefo.ccodigo_lote ? String(loteFefo.ccodigo_lote) : null,
                fechaVencimiento: String(loteFefo.fecha_vencimiento ?? ''),
                cantidad: Number(loteFefo.ncantidad ?? 0),
                diasParaVencer: Number(loteFefo.dias_para_vencer ?? 0),
              }
            : null,
          resumenEstados,
        },
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ success: false, error: 'Error al consultar lote FEFO' })
    }
  })

  // ──────────────────────────────────────────────────────────
  // GET /lotes/consistencia — Verificar bot_productos.nstock
  //   vs. suma de ncantidad en bot_lotes
  // Query: producto_id (opcional — para filtrar un producto)
  // ──────────────────────────────────────────────────────────
  fastify.get('/consistencia', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const q = request.query as { producto_id?: string }

    try {
      const params: unknown[] = []
      let filtro = ''
      if (q.producto_id) {
        params.push(Number(q.producto_id))
        filtro = `AND p.nid = $${params.length}`
      }

      const { rows } = await fastify.db.query(
        `SELECT
           p.nid                                          AS producto_id,
           p.cnombre                                      AS producto_nombre,
           p.ccodigo                                      AS producto_codigo,
           p.nstock                                       AS stock_producto,
           COALESCE(SUM(l.ncantidad), 0)::INT             AS stock_lotes,
           (p.nstock - COALESCE(SUM(l.ncantidad), 0))::INT AS diferencia,
           COUNT(l.nid)::INT                              AS total_lotes,
           COUNT(CASE WHEN l.cestado = 'ACTIVO'  THEN 1 END)::INT AS lotes_activos,
           COUNT(CASE WHEN l.cestado = 'AGOTADO' THEN 1 END)::INT AS lotes_agotados,
           COUNT(CASE WHEN l.cestado = 'VENCIDO' THEN 1 END)::INT AS lotes_vencidos
         FROM bot_productos p
         LEFT JOIN bot_lotes l ON l.nproducto_id = p.nid
           AND l.cestado IN ('ACTIVO', 'AGOTADO')
         WHERE p.cestado = 'A'
         ${filtro}
         GROUP BY p.nid, p.cnombre, p.ccodigo, p.nstock
         ORDER BY ABS(p.nstock - COALESCE(SUM(l.ncantidad), 0)) DESC, p.cnombre`,
        params,
      )

      const data = rows.map((row: Record<string, unknown>) => ({
        productoId: Number(row.producto_id),
        productoNombre: String(row.producto_nombre ?? '').trim(),
        productoCodigo: String(row.producto_codigo ?? '').trim(),
        stockProducto: Number(row.stock_producto ?? 0),
        stockLotes: Number(row.stock_lotes ?? 0),
        diferencia: Number(row.diferencia ?? 0),
        totalLotes: Number(row.total_lotes ?? 0),
        lotesActivos: Number(row.lotes_activos ?? 0),
        lotesAgotados: Number(row.lotes_agotados ?? 0),
        lotesVencidos: Number(row.lotes_vencidos ?? 0),
        consistente: Number(row.diferencia ?? 0) === 0,
      }))

      type LoteConsistencia = (typeof data)[0]
      const inconsistentes = data.filter((r: LoteConsistencia) => !r.consistente)
      const sinLotes = data.filter((r: LoteConsistencia) => r.totalLotes === 0 && r.stockProducto > 0)

      return {
        success: true,
        resumen: {
          totalProductos: data.length,
          productosConsistentes: data.length - inconsistentes.length,
          productosInconsistentes: inconsistentes.length,
          productosSinLotes: sinLotes.length,
        },
        inconsistencias: inconsistentes,
        data,
      }
    } catch (error) {
      request.log.error(error)
      return reply.code(500).send({ success: false, error: 'Error al verificar consistencia' })
    }
  })
}
