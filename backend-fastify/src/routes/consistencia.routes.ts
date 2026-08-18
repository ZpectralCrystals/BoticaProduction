import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function consistenciaRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  // ══════════════════════════════════════════════════════════
  // GET /consistencia/stock
  // Verifica: bot_productos.nstock vs SUM(bot_lotes.ncantidad)
  // ══════════════════════════════════════════════════════════
  fastify.get('/stock', { preHandler: fastify.requireAuth }, async (_request) => {
    const { rows } = await fastify.db.query(`
      SELECT
        p.nid AS producto_id,
        p.ccodigo AS producto_codigo,
        p.cnombre AS producto_nombre,
        p.nstock AS stock_tabla,
        COALESCE(SUM(l.ncantidad) FILTER (WHERE l.cestado = 'ACTIVO'), 0)::INT AS stock_lotes_activos,
        COALESCE(SUM(l.ncantidad) FILTER (WHERE l.cestado IN ('ACTIVO','AGOTADO')), 0)::INT AS stock_lotes_total,
        (p.nstock - COALESCE(SUM(l.ncantidad) FILTER (WHERE l.cestado = 'ACTIVO'), 0))::INT AS diferencia,
        COUNT(l.nid) FILTER (WHERE l.cestado = 'ACTIVO' AND l.ncantidad > 0)::INT AS lotes_con_stock,
        COUNT(l.nid) FILTER (WHERE l.nalmacen_id IS NULL AND l.cestado = 'ACTIVO')::INT AS lotes_sin_almacen
      FROM bot_productos p
      LEFT JOIN bot_lotes l ON l.nproducto_id = p.nid
      WHERE p.cestado = 'A'
        AND COALESCE(p.lrequiere_lote, TRUE) = TRUE
      GROUP BY p.nid, p.ccodigo, p.cnombre, p.nstock
      HAVING p.nstock != COALESCE(SUM(l.ncantidad) FILTER (WHERE l.cestado = 'ACTIVO'), 0)
         OR COUNT(l.nid) FILTER (WHERE l.nalmacen_id IS NULL AND l.cestado = 'ACTIVO') > 0
      ORDER BY ABS(p.nstock - COALESCE(SUM(l.ncantidad) FILTER (WHERE l.cestado = 'ACTIVO'), 0)) DESC
    `)

    const inconsistencias = rows.map((r: any) => ({
      productoId: r.producto_id,
      productoCodigo: r.producto_codigo?.trim(),
      productoNombre: r.producto_nombre?.trim(),
      stockTabla: Number(r.stock_tabla),
      stockLotesActivos: Number(r.stock_lotes_activos),
      diferencia: Number(r.diferencia),
      lotesConStock: Number(r.lotes_con_stock),
      lotesSinAlmacen: Number(r.lotes_sin_almacen),
      severidad: Math.abs(Number(r.diferencia)) > 10 ? 'CRITICA'
        : Math.abs(Number(r.diferencia)) > 0 ? 'MEDIA'
        : Number(r.lotes_sin_almacen) > 0 ? 'BAJA' : 'OK',
    }))

    return {
      success: true,
      tipo: 'STOCK_VS_LOTES',
      totalInconsistencias: inconsistencias.length,
      criticas: inconsistencias.filter((i: any) => i.severidad === 'CRITICA').length,
      medias: inconsistencias.filter((i: any) => i.severidad === 'MEDIA').length,
      bajas: inconsistencias.filter((i: any) => i.severidad === 'BAJA').length,
      inconsistencias,
    }
  })

  // ══════════════════════════════════════════════════════════
  // GET /consistencia/lotes
  // Verifica integridad de lotes: almacén válido, cantidad no negativa,
  // estado coherente, lotes vencidos sin marcar
  // ══════════════════════════════════════════════════════════
  fastify.get('/lotes', { preHandler: fastify.requireAuth }, async (_request) => {
    // Lotes vencidos no marcados
    const { rows: vencidosNoMarcados } = await fastify.db.query(`
      SELECT l.nid, l.nproducto_id, p.cnombre AS producto_nombre, p.ccodigo AS producto_codigo,
             l.ccodigo_lote, l.dfechavencimiento::TEXT, l.ncantidad, l.cestado,
             l.nalmacen_id, a.cnombre AS almacen_nombre
      FROM bot_lotes l
      JOIN bot_productos p ON p.nid = l.nproducto_id
      LEFT JOIN bot_almacenes a ON a.nid = l.nalmacen_id
      WHERE l.dfechavencimiento < CURRENT_DATE
        AND l.cestado = 'ACTIVO'
      ORDER BY l.dfechavencimiento ASC
    `)

    // Lotes activos sin almacén
    const { rows: sinAlmacen } = await fastify.db.query(`
      SELECT l.nid, l.nproducto_id, p.cnombre AS producto_nombre, p.ccodigo AS producto_codigo,
             l.ccodigo_lote, l.dfechavencimiento::TEXT, l.ncantidad
      FROM bot_lotes l
      JOIN bot_productos p ON p.nid = l.nproducto_id
      WHERE l.nalmacen_id IS NULL
        AND l.cestado = 'ACTIVO'
        AND l.ncantidad > 0
      ORDER BY l.nproducto_id
    `)

    // Lotes con almacén inactivo
    const { rows: almacenInactivo } = await fastify.db.query(`
      SELECT l.nid, l.nproducto_id, p.cnombre AS producto_nombre,
             l.ccodigo_lote, l.ncantidad, a.cnombre AS almacen_nombre, a.cestado AS almacen_estado
      FROM bot_lotes l
      JOIN bot_productos p ON p.nid = l.nproducto_id
      JOIN bot_almacenes a ON a.nid = l.nalmacen_id
      WHERE l.cestado = 'ACTIVO' AND l.ncantidad > 0
        AND a.cestado != 'A'
    `)

    const formatLote = (r: any) => ({
      loteId: r.nid,
      productoId: r.nproducto_id,
      productoNombre: r.producto_nombre?.trim(),
      productoCodigo: r.producto_codigo?.trim(),
      codigoLote: r.ccodigo_lote?.trim() || null,
      vencimiento: r.dfechavencimiento || null,
      cantidad: Number(r.ncantidad ?? 0),
      almacenId: r.nalmacen_id || null,
      almacenNombre: r.almacen_nombre?.trim() || null,
    })

    return {
      success: true,
      tipo: 'INTEGRIDAD_LOTES',
      vencidosNoMarcados: {
        total: vencidosNoMarcados.length,
        severidad: vencidosNoMarcados.length > 0 ? 'CRITICA' : 'OK',
        items: vencidosNoMarcados.map(formatLote),
      },
      sinAlmacen: {
        total: sinAlmacen.length,
        severidad: sinAlmacen.length > 0 ? 'MEDIA' : 'OK',
        items: sinAlmacen.map(formatLote),
      },
      almacenInactivo: {
        total: almacenInactivo.length,
        severidad: almacenInactivo.length > 0 ? 'MEDIA' : 'OK',
        items: almacenInactivo.map(formatLote),
      },
    }
  })

  // ══════════════════════════════════════════════════════════
  // GET /consistencia/kardex
  // Verifica: saldo calculado por kardex vs stock real del producto
  // y vs stock de lotes
  // ══════════════════════════════════════════════════════════
  fastify.get('/kardex', { preHandler: fastify.requireAuth }, async (_request) => {
    // Compare last kardex nstock_nuevo with actual bot_productos.nstock
    const { rows: desyncProducto } = await fastify.db.query(`
      WITH ultimo_kardex AS (
        SELECT DISTINCT ON (nproducto_id)
          nproducto_id, nstock_nuevo, ctipo, tcreado
        FROM bot_kardex
        ORDER BY nproducto_id, nid DESC
      )
      SELECT
        uk.nproducto_id AS producto_id,
        p.ccodigo AS producto_codigo,
        p.cnombre AS producto_nombre,
        uk.nstock_nuevo AS stock_segun_kardex,
        p.nstock AS stock_tabla,
        (p.nstock - uk.nstock_nuevo)::INT AS diferencia,
        uk.ctipo AS ultimo_tipo,
        uk.tcreado::TEXT AS ultimo_movimiento
      FROM ultimo_kardex uk
      JOIN bot_productos p ON p.nid = uk.nproducto_id
      WHERE p.nstock != uk.nstock_nuevo
      ORDER BY ABS(p.nstock - uk.nstock_nuevo) DESC
    `)

    // Count movements by type for general sanity
    const { rows: resumenKardex } = await fastify.db.query(`
      SELECT ctipo, COUNT(*)::INT AS total,
             SUM(ncantidad)::INT AS suma_cantidades
      FROM bot_kardex
      GROUP BY ctipo
      ORDER BY ctipo
    `)

    // Verify no kardex entries with impossible stock (negative)
    const { rows: stockNegativo } = await fastify.db.query(`
      SELECT nid, nproducto_id, ctipo, ncantidad, nstock_anterior, nstock_nuevo, tcreado::TEXT
      FROM bot_kardex
      WHERE nstock_nuevo < 0
      ORDER BY tcreado DESC
      LIMIT 50
    `)

    return {
      success: true,
      tipo: 'KARDEX_VS_STOCK',
      desyncProductoKardex: {
        total: desyncProducto.length,
        severidad: desyncProducto.length > 0 ? 'MEDIA' : 'OK',
        items: desyncProducto.map((r: any) => ({
          productoId: r.producto_id,
          productoCodigo: r.producto_codigo?.trim(),
          productoNombre: r.producto_nombre?.trim(),
          stockSegunKardex: Number(r.stock_segun_kardex),
          stockTabla: Number(r.stock_tabla),
          diferencia: Number(r.diferencia),
          ultimoTipo: r.ultimo_tipo,
          ultimoMovimiento: r.ultimo_movimiento,
        })),
      },
      stockNegativoEnKardex: {
        total: stockNegativo.length,
        severidad: stockNegativo.length > 0 ? 'CRITICA' : 'OK',
        items: stockNegativo.map((r: any) => ({
          kardexId: r.nid,
          productoId: r.nproducto_id,
          tipo: r.ctipo,
          cantidad: r.ncantidad,
          stockAnterior: r.nstock_anterior,
          stockNuevo: r.nstock_nuevo,
          fecha: r.tcreado,
        })),
      },
      resumenKardex: resumenKardex.map((r: any) => ({
        tipo: r.ctipo,
        total: r.total,
        sumaCantidades: r.suma_cantidades,
      })),
    }
  })

  // ══════════════════════════════════════════════════════════
  // GET /consistencia/resumen
  // Resumen ejecutivo de todas las verificaciones
  // ══════════════════════════════════════════════════════════
  fastify.get('/resumen', { preHandler: fastify.requireAuth }, async (_request) => {
    // A. Stock vs Lotes
    const { rows: [stockRow] } = await fastify.db.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(p.lrequiere_lote, TRUE) = TRUE
            AND p.nstock != COALESCE(l.stock_lotes, 0)
        )::INT AS stock_vs_lotes,
        COUNT(*) FILTER (
          WHERE COALESCE(p.lrequiere_lote, TRUE) = TRUE
            AND p.nstock > 0 AND COALESCE(l.total_lotes, 0) = 0
        )::INT AS stock_sin_lotes
      FROM bot_productos p
      LEFT JOIN (
        SELECT nproducto_id,
               SUM(ncantidad) FILTER (WHERE cestado = 'ACTIVO') AS stock_lotes,
               COUNT(*) AS total_lotes
        FROM bot_lotes GROUP BY nproducto_id
      ) l ON l.nproducto_id = p.nid
      WHERE p.cestado = 'A'
    `)

    // B. Lotes vencidos sin marcar
    const { rows: [lotesRow] } = await fastify.db.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE dfechavencimiento < CURRENT_DATE AND cestado = 'ACTIVO'
        )::INT AS vencidos_no_marcados,
        COUNT(*) FILTER (
          WHERE nalmacen_id IS NULL AND cestado = 'ACTIVO' AND ncantidad > 0
        )::INT AS sin_almacen
      FROM bot_lotes
    `)

    // C. Kardex desync
    const { rows: [kardexRow] } = await fastify.db.query(`
      WITH ultimo AS (
        SELECT DISTINCT ON (nproducto_id) nproducto_id, nstock_nuevo
        FROM bot_kardex ORDER BY nproducto_id, nid DESC
      )
      SELECT
        COUNT(*) FILTER (WHERE p.nstock != u.nstock_nuevo)::INT AS kardex_desync,
        COUNT(*) FILTER (WHERE u.nstock_nuevo < 0)::INT AS kardex_negativos
      FROM ultimo u
      JOIN bot_productos p ON p.nid = u.nproducto_id
    `)

    // D. Stock vendible vs no vendible
    const { rows: [almacenRow] } = await fastify.db.query(`
      SELECT
        COALESCE(SUM(l.ncantidad) FILTER (WHERE a.bpermite_venta = TRUE), 0)::INT AS stock_vendible,
        COALESCE(SUM(l.ncantidad) FILTER (WHERE a.bpermite_venta = FALSE OR a.bpermite_venta IS NULL), 0)::INT AS stock_no_vendible,
        COUNT(DISTINCT a.nid) FILTER (WHERE a.cestado = 'A')::INT AS almacenes_activos
      FROM bot_lotes l
      JOIN bot_almacenes a ON a.nid = l.nalmacen_id
      WHERE l.cestado = 'ACTIVO' AND l.ncantidad > 0
    `)

    const checks = [
      {
        check: 'STOCK_VS_LOTES',
        descripcion: 'bot_productos.nstock coincide con SUM(bot_lotes activos)',
        inconsistencias: Number(stockRow?.stock_vs_lotes ?? 0),
        severidad: Number(stockRow?.stock_vs_lotes ?? 0) > 0 ? 'CRITICA' : 'OK',
      },
      {
        check: 'STOCK_SIN_LOTES',
        descripcion: 'Productos con stock global pero sin lotes activos',
        inconsistencias: Number(stockRow?.stock_sin_lotes ?? 0),
        severidad: Number(stockRow?.stock_sin_lotes ?? 0) > 0 ? 'MEDIA' : 'OK',
      },
      {
        check: 'LOTES_VENCIDOS',
        descripcion: 'Lotes vencidos aún marcados como ACTIVO',
        inconsistencias: Number(lotesRow?.vencidos_no_marcados ?? 0),
        severidad: Number(lotesRow?.vencidos_no_marcados ?? 0) > 0 ? 'CRITICA' : 'OK',
      },
      {
        check: 'LOTES_SIN_ALMACEN',
        descripcion: 'Lotes activos con stock sin almacén asignado',
        inconsistencias: Number(lotesRow?.sin_almacen ?? 0),
        severidad: Number(lotesRow?.sin_almacen ?? 0) > 0 ? 'MEDIA' : 'OK',
      },
      {
        check: 'KARDEX_DESYNC',
        descripcion: 'Último kardex no coincide con stock actual',
        inconsistencias: Number(kardexRow?.kardex_desync ?? 0),
        severidad: Number(kardexRow?.kardex_desync ?? 0) > 0 ? 'MEDIA' : 'OK',
      },
      {
        check: 'KARDEX_NEGATIVOS',
        descripcion: 'Entradas de kardex con stock resultante negativo',
        inconsistencias: Number(kardexRow?.kardex_negativos ?? 0),
        severidad: Number(kardexRow?.kardex_negativos ?? 0) > 0 ? 'CRITICA' : 'OK',
      },
    ]

    const totalInconsistencias = checks.reduce((s, c) => s + c.inconsistencias, 0)
    const maxSeveridad = checks.some(c => c.severidad === 'CRITICA') ? 'CRITICA'
      : checks.some(c => c.severidad === 'MEDIA') ? 'MEDIA'
      : checks.some(c => c.severidad === 'BAJA') ? 'BAJA' : 'OK'

    return {
      success: true,
      tipo: 'RESUMEN_CONSISTENCIA',
      estadoGeneral: maxSeveridad,
      totalInconsistencias,
      stockVendible: Number(almacenRow?.stock_vendible ?? 0),
      stockNoVendible: Number(almacenRow?.stock_no_vendible ?? 0),
      almacenesActivos: Number(almacenRow?.almacenes_activos ?? 0),
      checks,
    }
  })

  // ══════════════════════════════════════════════════════════
  // POST /consistencia/reconciliar
  // Sincroniza bot_productos.nstock desde SUM(bot_lotes activos)
  // Solo ejecutable por admins
  // ══════════════════════════════════════════════════════════
  fastify.post('/reconciliar', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['consistencia', 'auditoria'], {
      errorMessage: 'No tiene permisos para ejecutar reconciliación de stock',
    }))) {
      return
    }

    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as { dryRun?: boolean }
    const dryRun = body.dryRun !== false // default true for safety

    if (!dryRun && !user.admin && !user.super) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: 'Solo administradores pueden aplicar una reconciliación',
      })
    }

    const { rows } = await fastify.db.query(`
      SELECT
        p.nid AS producto_id,
        p.ccodigo AS producto_codigo,
        p.cnombre AS producto_nombre,
        p.nstock AS stock_actual,
        COALESCE(SUM(l.ncantidad) FILTER (WHERE l.cestado = 'ACTIVO'), 0)::INT AS stock_correcto
      FROM bot_productos p
      LEFT JOIN bot_lotes l ON l.nproducto_id = p.nid
      WHERE p.cestado = 'A'
        AND COALESCE(p.lrequiere_lote, TRUE) = TRUE
      GROUP BY p.nid, p.ccodigo, p.cnombre, p.nstock
      HAVING p.nstock != COALESCE(SUM(l.ncantidad) FILTER (WHERE l.cestado = 'ACTIVO'), 0)
    `)

    const { rows: kardexRows } = await fastify.db.query(`
      WITH ultimo AS (
        SELECT DISTINCT ON (nproducto_id)
          nproducto_id, nstock_nuevo
        FROM bot_kardex
        ORDER BY nproducto_id, nid DESC
      )
      SELECT
        p.nid AS producto_id,
        p.ccodigo AS producto_codigo,
        p.cnombre AS producto_nombre,
        u.nstock_nuevo AS stock_kardex,
        p.nstock AS stock_actual
      FROM ultimo u
      JOIN bot_productos p ON p.nid = u.nproducto_id
      WHERE p.cestado = 'A'
        AND p.nstock != u.nstock_nuevo
      ORDER BY p.nid
    `)

    const correcciones = rows.map((r: any) => ({
      productoId: r.producto_id,
      productoCodigo: r.producto_codigo?.trim(),
      productoNombre: r.producto_nombre?.trim(),
      stockAnterior: Number(r.stock_actual),
      stockCorrecto: Number(r.stock_correcto),
      diferencia: Number(r.stock_correcto) - Number(r.stock_actual),
    }))

    const productosConStockCorregido = new Set(correcciones.map((corr) => corr.productoId))
    const alineacionesKardex = kardexRows
      .filter((r: any) => !productosConStockCorregido.has(Number(r.producto_id)))
      .map((r: any) => ({
        productoId: Number(r.producto_id),
        productoCodigo: r.producto_codigo?.trim(),
        productoNombre: r.producto_nombre?.trim(),
        stockKardex: Number(r.stock_kardex),
        stockActual: Number(r.stock_actual),
      }))

    if (!dryRun && (correcciones.length > 0 || alineacionesKardex.length > 0)) {
      const client = await fastify.db.connect()
      try {
        await client.query('BEGIN')
        for (const corr of correcciones) {
          await client.query(
            'UPDATE bot_productos SET nstock = $1, tmodifi = NOW() WHERE nid = $2',
            [corr.stockCorrecto, corr.productoId],
          )
          await client.query(
            `INSERT INTO bot_kardex
             (nproducto_id, ctipo, cref_tabla, ncantidad,
              nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario)
             VALUES ($1, 'RECONCILIACION', 'bot_productos', $2, $3, $4, $5, $6, $7)`,
            [
              corr.productoId,
              corr.diferencia,
              corr.stockAnterior,
              corr.stockCorrecto,
              `Reconciliación automática: ${corr.stockAnterior} → ${corr.stockCorrecto}`,
              user.id,
              user.nombre,
            ],
          )
        }
        for (const alineacion of alineacionesKardex) {
          await client.query(
            `INSERT INTO bot_kardex
             (nproducto_id, ctipo, cref_tabla, nref_id, ncantidad,
              nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario)
             VALUES ($1, 'RECONCILIACION_KARDEX', 'bot_productos', $1, 0, $2, $3, $4, $5, $6)`,
            [
              alineacion.productoId,
              alineacion.stockKardex,
              alineacion.stockActual,
              `Alineación de Kardex: ${alineacion.stockKardex} → ${alineacion.stockActual}`,
              user.id,
              user.nombre,
            ],
          )
        }
        await client.query(
          `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, cdetalle)
           VALUES ($1, $2, 'RECONCILIACION', 'bot_productos', $3)`,
          [
            user.id,
            user.nombre,
            `Stock corregido: ${correcciones.length}; Kardex alineado: ${alineacionesKardex.length}`,
          ],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    return {
      success: true,
      dryRun,
      totalCorregidos: correcciones.length + alineacionesKardex.length,
      totalStockCorregido: correcciones.length,
      totalKardexAlineado: alineacionesKardex.length,
      correcciones,
      alineacionesKardex,
    }
  })

  // ══════════════════════════════════════════════════════════
  // POST /consistencia/marcar-vencidos
  // Marca lotes vencidos como VENCIDO y ajusta stock
  // ══════════════════════════════════════════════════════════
  fastify.post('/marcar-vencidos', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['consistencia', 'auditoria'], {
      errorMessage: 'No tiene permisos para marcar lotes vencidos',
    }))) {
      return
    }

    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as { dryRun?: boolean }
    const dryRun = body.dryRun !== false

    if (!dryRun && !user.admin && !user.super) {
      return reply.code(403).send({
        error: 'FORBIDDEN',
        message: 'Solo administradores pueden aplicar el marcado de vencidos',
      })
    }

    const { rows } = await fastify.db.query(`
      SELECT l.nid, l.nproducto_id, l.ccodigo_lote, l.ncantidad, l.nalmacen_id,
             p.cnombre AS producto_nombre, p.nstock
      FROM bot_lotes l
      JOIN bot_productos p ON p.nid = l.nproducto_id
      WHERE l.dfechavencimiento < CURRENT_DATE
        AND l.cestado = 'ACTIVO'
      ORDER BY l.dfechavencimiento
    `)

    const marcados = rows.map((r: any) => ({
      loteId: r.nid,
      productoId: r.nproducto_id,
      productoNombre: r.producto_nombre?.trim(),
      codigoLote: r.ccodigo_lote?.trim() || null,
      cantidad: Number(r.ncantidad),
      almacenId: r.nalmacen_id,
    }))

    if (!dryRun && marcados.length > 0) {
      const client = await fastify.db.connect()
      try {
        await client.query('BEGIN')
        for (const lote of marcados) {
          await client.query(
            `UPDATE bot_lotes SET cestado = 'VENCIDO', tmodifi = NOW() WHERE nid = $1`,
            [lote.loteId],
          )
          if (lote.cantidad > 0) {
            const stockResult = await client.query<{ nstock: number }>(
              'SELECT nstock FROM bot_productos WHERE nid = $1 FOR UPDATE',
              [lote.productoId],
            )
            const stockPrev = Number(stockResult.rows[0]?.nstock ?? 0)
            const stockNew = Math.max(0, stockPrev - lote.cantidad)
            await client.query(
              'UPDATE bot_productos SET nstock = $1, tmodifi = NOW() WHERE nid = $2',
              [stockNew, lote.productoId],
            )
            await client.query(
              `INSERT INTO bot_kardex
               (nproducto_id, nlote_id, ccodigo_lote, ctipo, cref_tabla, ncantidad,
                nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
               VALUES ($1, $2, $3, 'VENCIMIENTO', 'bot_lotes', $4, $5, $6, $7, $8, $9, $10)`,
              [
                lote.productoId, lote.loteId, lote.codigoLote,
                -lote.cantidad, stockPrev, stockNew,
                `Lote vencido: ${lote.codigoLote || lote.loteId}`,
                user.id, user.nombre, lote.almacenId,
              ],
            )
          }
        }
        await client.query(
          `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, cdetalle)
           VALUES ($1, $2, 'MARCAR_VENCIDOS', 'bot_lotes', $3)`,
          [user.id, user.nombre, `Marcados ${marcados.length} lotes como VENCIDO`],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }

    return {
      success: true,
      dryRun,
      totalMarcados: marcados.length,
      marcados,
    }
  })

  // ══════════════════════════════════════════════════════════
  // GET /consistencia/alertas
  // Alertas operativas: vencimientos, cuarentena, baja,
  // stock fantasma, inconsistencias
  // ══════════════════════════════════════════════════════════
  fastify.get('/alertas', { preHandler: fastify.requireAuth }, async (_request) => {
    // Lotes por vencer (30 días)
    const { rows: porVencer } = await fastify.db.query(`
      SELECT l.nid, l.nproducto_id, p.cnombre AS producto_nombre, p.ccodigo AS producto_codigo,
             l.ccodigo_lote, l.dfechavencimiento::TEXT, l.ncantidad,
             (l.dfechavencimiento - CURRENT_DATE) AS dias,
             a.cnombre AS almacen_nombre
      FROM bot_lotes l
      JOIN bot_productos p ON p.nid = l.nproducto_id
      LEFT JOIN bot_almacenes a ON a.nid = l.nalmacen_id
      WHERE l.cestado = 'ACTIVO' AND l.ncantidad > 0
        AND l.dfechavencimiento BETWEEN CURRENT_DATE AND (CURRENT_DATE + 30)
      ORDER BY l.dfechavencimiento ASC
    `)

    // Stock en cuarentena
    const { rows: enCuarentena } = await fastify.db.query(`
      SELECT p.nid AS producto_id, p.cnombre AS producto_nombre, p.ccodigo AS producto_codigo,
             a.cnombre AS almacen_nombre, SUM(l.ncantidad)::INT AS stock
      FROM bot_lotes l
      JOIN bot_productos p ON p.nid = l.nproducto_id
      JOIN bot_almacenes a ON a.nid = l.nalmacen_id
      WHERE l.cestado = 'ACTIVO' AND l.ncantidad > 0
        AND a.ctipo_almacen = 'CUARENTENA'
      GROUP BY p.nid, p.cnombre, p.ccodigo, a.cnombre
      ORDER BY stock DESC
    `)

    // Stock en baja
    const { rows: enBaja } = await fastify.db.query(`
      SELECT p.nid AS producto_id, p.cnombre AS producto_nombre, p.ccodigo AS producto_codigo,
             a.cnombre AS almacen_nombre, SUM(l.ncantidad)::INT AS stock
      FROM bot_lotes l
      JOIN bot_productos p ON p.nid = l.nproducto_id
      JOIN bot_almacenes a ON a.nid = l.nalmacen_id
      WHERE l.cestado = 'ACTIVO' AND l.ncantidad > 0
        AND a.ctipo_almacen = 'BAJA'
      GROUP BY p.nid, p.cnombre, p.ccodigo, a.cnombre
      ORDER BY stock DESC
    `)

    // Productos con stock global pero sin lotes
    const { rows: stockFantasma } = await fastify.db.query(`
      SELECT p.nid AS producto_id, p.cnombre AS producto_nombre, p.ccodigo AS producto_codigo,
             p.nstock
      FROM bot_productos p
      LEFT JOIN bot_lotes l ON l.nproducto_id = p.nid AND l.cestado = 'ACTIVO' AND l.ncantidad > 0
      WHERE p.cestado = 'A'
        AND COALESCE(p.lrequiere_lote, TRUE) = TRUE
        AND p.nstock > 0 AND l.nid IS NULL
      ORDER BY p.nstock DESC
    `)

    const totalAlertas =
      porVencer.length +
      enCuarentena.length +
      enBaja.length +
      stockFantasma.length
    const lotesCriticos = porVencer.filter((r: any) => Number(r.dias) <= 7).length

    return {
      success: true,
      tipo: 'ALERTAS_OPERATIVAS',
      resumen: {
        totalAlertas,
        alertasCriticas: lotesCriticos + enBaja.length + stockFantasma.length,
        stockNoVendible:
          enCuarentena.reduce((s: number, r: any) => s + Number(r.stock), 0) +
          enBaja.reduce((s: number, r: any) => s + Number(r.stock), 0),
        lotesPorVencerCriticos: lotesCriticos,
      },
      porVencer: {
        total: porVencer.length,
        items: porVencer.map((r: any) => ({
          loteId: r.nid, productoId: r.nproducto_id,
          productoNombre: r.producto_nombre?.trim(),
          productoCodigo: r.producto_codigo?.trim(),
          codigoLote: r.ccodigo_lote?.trim(),
          vencimiento: r.dfechavencimiento, dias: Number(r.dias),
          cantidad: Number(r.ncantidad),
          almacen: r.almacen_nombre?.trim(),
        })),
      },
      enCuarentena: {
        total: enCuarentena.length,
        totalUnidades: enCuarentena.reduce((s: number, r: any) => s + Number(r.stock), 0),
        items: enCuarentena.map((r: any) => ({
          productoId: r.producto_id,
          productoNombre: r.producto_nombre?.trim(),
          productoCodigo: r.producto_codigo?.trim(),
          almacen: r.almacen_nombre?.trim(),
          stock: Number(r.stock),
        })),
      },
      enBaja: {
        total: enBaja.length,
        totalUnidades: enBaja.reduce((s: number, r: any) => s + Number(r.stock), 0),
        items: enBaja.map((r: any) => ({
          productoId: r.producto_id,
          productoNombre: r.producto_nombre?.trim(),
          productoCodigo: r.producto_codigo?.trim(),
          almacen: r.almacen_nombre?.trim(),
          stock: Number(r.stock),
        })),
      },
      stockFantasma: {
        total: stockFantasma.length,
        items: stockFantasma.map((r: any) => ({
          productoId: r.producto_id,
          productoNombre: r.producto_nombre?.trim(),
          productoCodigo: r.producto_codigo?.trim(),
          stockSinLotes: Number(r.nstock),
        })),
      },
    }
  })
}
