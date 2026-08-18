import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function trasladosAlmacenRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  // ══════════════════════════════════════════════════════════
  // POST /traslados-almacen
  // Traslado real entre almacenes con control de lotes
  // Mueve stock de almacén origen → almacén destino
  // ══════════════════════════════════════════════════════════
  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['traslados-almacen', 'transferencias', 'almacenes'], {
      errorMessage: 'No tiene permisos para trasladar stock entre almacenes',
    }))) {
      return
    }

    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      productoId?: number
      loteId?: number
      almacenOrigenId?: number
      almacenDestinoId?: number
      cantidad?: number
      motivo?: string
    }

    const productoId = Number(body.productoId || 0)
    const loteId = Number(body.loteId || 0)
    const almacenOrigenId = Number(body.almacenOrigenId || 0)
    const almacenDestinoId = Number(body.almacenDestinoId || 0)
    const cantidad = Number(body.cantidad || 0)
    const motivo = String(body.motivo || '').trim()

    if (productoId <= 0) return reply.code(400).send({ error: 'productoId requerido' })
    if (almacenOrigenId <= 0) return reply.code(400).send({ error: 'almacenOrigenId requerido' })
    if (almacenDestinoId <= 0) return reply.code(400).send({ error: 'almacenDestinoId requerido' })
    if (almacenOrigenId === almacenDestinoId) return reply.code(400).send({ error: 'Origen y destino deben ser diferentes' })
    if (cantidad <= 0) return reply.code(400).send({ error: 'cantidad debe ser > 0' })

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      // 1. Validate almacenes
      const origenResult = await client.query<{ nid: number; cnombre: string; cestado: string }>(
        'SELECT nid, cnombre, cestado FROM bot_almacenes WHERE nid = $1',
        [almacenOrigenId],
      )
      const destinoResult = await client.query<{ nid: number; cnombre: string; cestado: string }>(
        'SELECT nid, cnombre, cestado FROM bot_almacenes WHERE nid = $1',
        [almacenDestinoId],
      )

      if (!origenResult.rows[0] || origenResult.rows[0].cestado !== 'A') {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'Almacén origen no encontrado o inactivo' })
      }
      if (!destinoResult.rows[0] || destinoResult.rows[0].cestado !== 'A') {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'Almacén destino no encontrado o inactivo' })
      }

      const origenNombre = origenResult.rows[0].cnombre.trim()
      const destinoNombre = destinoResult.rows[0].cnombre.trim()

      // 2. Validate producto
      const prodResult = await client.query<{ cnombre: string; nstock: number }>(
        'SELECT cnombre, nstock FROM bot_productos WHERE nid = $1 AND cestado = $2 FOR UPDATE',
        [productoId, 'A'],
      )
      if (!prodResult.rows[0]) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'Producto no encontrado o inactivo' })
      }

      let loteOrigen: any = null

      if (loteId > 0) {
        // 3a. Move a specific lote
        const loteResult = await client.query(
          `SELECT nid, nproducto_id, ncantidad, nalmacen_id, ccodigo_lote, nversion
           FROM bot_lotes
           WHERE nid = $1 AND nproducto_id = $2 AND cestado = 'ACTIVO'
           FOR UPDATE`,
          [loteId, productoId],
        )
        loteOrigen = loteResult.rows[0]
        if (!loteOrigen) {
          await client.query('ROLLBACK')
          return reply.code(404).send({ error: 'Lote no encontrado o inactivo' })
        }
        if (Number(loteOrigen.nalmacen_id) !== almacenOrigenId) {
          await client.query('ROLLBACK')
          return reply.code(400).send({ error: `Lote no pertenece al almacén origen (está en almacén ${loteOrigen.nalmacen_id})` })
        }
        if (Number(loteOrigen.ncantidad) < cantidad) {
          await client.query('ROLLBACK')
          return reply.code(400).send({
            error: `Stock insuficiente en lote: tiene ${loteOrigen.ncantidad}, se requieren ${cantidad}`,
          })
        }

        if (Number(loteOrigen.ncantidad) === cantidad) {
          // Move entire lote to new almacen
          const upd = await client.query(
            `UPDATE bot_lotes SET nalmacen_id = $1, tmodifi = NOW(), nversion = nversion + 1
             WHERE nid = $2 AND nversion = $3`,
            [almacenDestinoId, loteId, loteOrigen.nversion],
          )
          if (upd.rowCount === 0) {
            await client.query('ROLLBACK')
            return reply.code(409).send({ error: 'Conflicto de versión en lote (optimistic lock)' })
          }
        } else {
          // Partial: reduce origin, create new lote in destination
          const upd = await client.query(
            `UPDATE bot_lotes SET ncantidad = ncantidad - $1, tmodifi = NOW(), nversion = nversion + 1
             WHERE nid = $2 AND nversion = $3`,
            [cantidad, loteId, loteOrigen.nversion],
          )
          if (upd.rowCount === 0) {
            await client.query('ROLLBACK')
            return reply.code(409).send({ error: 'Conflicto de versión en lote (optimistic lock)' })
          }
          // Get original lote data for new lote
          const origLote = await client.query(
            `SELECT ccodigo_lote, dfechavencimiento, ncompra_id FROM bot_lotes WHERE nid = $1`,
            [loteId],
          )
          const ol = origLote.rows[0]
          await client.query(
            `INSERT INTO bot_lotes
             (nproducto_id, ncompra_id, ccodigo_lote, dfechavencimiento, ncantidad, ncantidad_inicial, nalmacen_id, cnotas)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              productoId, ol.ncompra_id, ol.ccodigo_lote, ol.dfechavencimiento,
              cantidad, cantidad, almacenDestinoId,
              `Traslado parcial desde lote ${loteId}: ${motivo}`,
            ],
          )
        }
      } else {
        // 3b. No specific lote: use FEFO from origin almacen
        const lotesResult = await client.query(
          `SELECT nid, ncantidad, ccodigo_lote, nversion, dfechavencimiento, ncompra_id
           FROM bot_lotes
           WHERE nproducto_id = $1 AND nalmacen_id = $2
             AND cestado = 'ACTIVO' AND ncantidad > 0
             AND dfechavencimiento >= CURRENT_DATE
           ORDER BY dfechavencimiento ASC, tcreado ASC
           FOR UPDATE`,
          [productoId, almacenOrigenId],
        )

        let pendiente = cantidad
        for (const lote of lotesResult.rows as any[]) {
          if (pendiente <= 0) break
          const disponible = Number(lote.ncantidad)
          const tomar = Math.min(disponible, pendiente)

          if (tomar === disponible) {
            // Move entire lote
            await client.query(
              `UPDATE bot_lotes SET nalmacen_id = $1, tmodifi = NOW(), nversion = nversion + 1
               WHERE nid = $2 AND nversion = $3`,
              [almacenDestinoId, lote.nid, lote.nversion],
            )
          } else {
            // Partial
            await client.query(
              `UPDATE bot_lotes SET ncantidad = ncantidad - $1, tmodifi = NOW(), nversion = nversion + 1
               WHERE nid = $2 AND nversion = $3`,
              [tomar, lote.nid, lote.nversion],
            )
            await client.query(
              `INSERT INTO bot_lotes
               (nproducto_id, ncompra_id, ccodigo_lote, dfechavencimiento, ncantidad, ncantidad_inicial, nalmacen_id, cnotas)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                productoId, lote.ncompra_id, lote.ccodigo_lote, lote.dfechavencimiento,
                tomar, tomar, almacenDestinoId,
                `Traslado parcial FEFO: ${motivo}`,
              ],
            )
          }
          pendiente -= tomar
        }

        if (pendiente > 0) {
          await client.query('ROLLBACK')
          return reply.code(400).send({
            error: `Stock insuficiente en almacén origen: faltan ${pendiente} unidades`,
          })
        }
      }

      // 4. Record movimiento almacén (salida de origen)
      await client.query(
        `INSERT INTO bot_movimientos_almacen
         (nproducto_id, nlote_id, nalmacen_origen_id, nalmacen_destino_id,
          ctipo_movimiento, ncantidad, cdetalle, nusuario_id, cusuario)
         VALUES ($1, $2, $3, $4, 'TRASLADO', $5, $6, $7, $8)`,
        [
          productoId, loteId > 0 ? loteId : null,
          almacenOrigenId, almacenDestinoId,
          cantidad,
          `Traslado ${origenNombre} → ${destinoNombre}: ${motivo}`,
          user.id, user.nombre,
        ],
      )

      // 5. Record kardex (stock de producto no cambia, solo ubicación)
      const stockActual = Number(prodResult.rows[0].nstock)
      await client.query(
        `INSERT INTO bot_kardex
         (nproducto_id, nlote_id, ccodigo_lote, ctipo, cref_tabla,
          ncantidad, nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
         VALUES ($1, $2, $3, 'TRASLADO', 'bot_movimientos_almacen',
                 $4, $5, $6, $7, $8, $9, $10)`,
        [
          productoId, loteId > 0 ? loteId : null,
          loteOrigen?.ccodigo_lote?.trim() || null,
          0, stockActual, stockActual,
          `Traslado ${origenNombre} → ${destinoNombre}: ${motivo}`,
          user.id, user.nombre, almacenOrigenId,
        ],
      )

      // 6. Audit
      await client.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, cdetalle)
         VALUES ($1, $2, 'TRASLADO_ALMACEN', 'bot_movimientos_almacen', $3)`,
        [user.id, user.nombre,
         `${productoId}: ${cantidad}u ${origenNombre} → ${destinoNombre} | ${motivo}`],
      )

      await client.query('COMMIT')
      return {
        ok: true,
        productoId,
        cantidad,
        almacenOrigen: { id: almacenOrigenId, nombre: origenNombre },
        almacenDestino: { id: almacenDestinoId, nombre: destinoNombre },
      }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  // ══════════════════════════════════════════════════════════
  // GET /traslados-almacen — Historial de traslados
  // ══════════════════════════════════════════════════════════
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { productoId?: string; limit?: string }
    const limit = Math.min(Number(query.limit || 50), 200)
    const params: unknown[] = []
    let where = `WHERE m.ctipo_movimiento = 'TRASLADO'`

    if (query.productoId) {
      params.push(Number(query.productoId))
      where += ` AND m.nproducto_id = $${params.length}`
    }

    params.push(limit)
    const { rows } = await fastify.db.query(
      `SELECT m.nid, m.nproducto_id, p.cnombre AS producto_nombre, p.ccodigo AS producto_codigo,
              m.nlote_id, m.nalmacen_origen_id, ao.cnombre AS almacen_origen,
              m.nalmacen_destino_id, ad.cnombre AS almacen_destino,
              m.ncantidad, m.cdetalle, m.cusuario, m.tcreado::TEXT
       FROM bot_movimientos_almacen m
       JOIN bot_productos p ON p.nid = m.nproducto_id
       LEFT JOIN bot_almacenes ao ON ao.nid = m.nalmacen_origen_id
       LEFT JOIN bot_almacenes ad ON ad.nid = m.nalmacen_destino_id
       ${where}
       ORDER BY m.tcreado DESC
       LIMIT $${params.length}`,
      params,
    )

    return {
      success: true,
      total: rows.length,
      data: rows.map((r: any) => ({
        id: r.nid,
        productoId: r.nproducto_id,
        productoNombre: r.producto_nombre?.trim(),
        productoCodigo: r.producto_codigo?.trim(),
        loteId: r.nlote_id,
        almacenOrigen: { id: r.nalmacen_origen_id, nombre: r.almacen_origen?.trim() },
        almacenDestino: { id: r.nalmacen_destino_id, nombre: r.almacen_destino?.trim() },
        cantidad: Number(r.ncantidad),
        detalle: r.cdetalle,
        usuario: r.cusuario?.trim(),
        fecha: r.tcreado,
      })),
    }
  })

  // ══════════════════════════════════════════════════════════
  // POST /traslados-almacen/devolucion-cliente
  // Devuelve stock a almacén (ej: cuarentena) tras devolución
  // ══════════════════════════════════════════════════════════
  fastify.post('/devolucion-cliente', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['devoluciones', 'traslados-almacen', 'almacenes'], {
      errorMessage: 'No tiene permisos para registrar devoluciones de cliente',
    }))) {
      return
    }

    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      productoId?: number
      almacenDestinoId?: number
      cantidad?: number
      motivo?: string
      loteId?: number
    }

    const productoId = Number(body.productoId || 0)
    const almacenDestinoId = Number(body.almacenDestinoId || 0)
    const cantidad = Number(body.cantidad || 0)
    const motivo = String(body.motivo || 'Devolución de cliente').trim()
    const loteId = Number(body.loteId || 0)

    if (productoId <= 0) return reply.code(400).send({ error: 'productoId requerido' })
    if (almacenDestinoId <= 0) return reply.code(400).send({ error: 'almacenDestinoId requerido' })
    if (cantidad <= 0) return reply.code(400).send({ error: 'cantidad debe ser > 0' })

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      const almResult = await client.query<{ cnombre: string; cestado: string }>(
        'SELECT cnombre, cestado FROM bot_almacenes WHERE nid = $1',
        [almacenDestinoId],
      )
      if (!almResult.rows[0] || almResult.rows[0].cestado !== 'A') {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'Almacén destino no encontrado o inactivo' })
      }
      const almNombre = almResult.rows[0].cnombre.trim()

      const prodResult = await client.query<{ cnombre: string; nstock: number }>(
        'SELECT cnombre, nstock FROM bot_productos WHERE nid = $1 FOR UPDATE',
        [productoId],
      )
      if (!prodResult.rows[0]) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'Producto no encontrado' })
      }
      const stockPrev = Number(prodResult.rows[0].nstock)

      // Update stock
      await client.query(
        'UPDATE bot_productos SET nstock = nstock + $1, tmodifi = NOW() WHERE nid = $2',
        [cantidad, productoId],
      )

      // Create or update lote in destination
      if (loteId > 0) {
        await client.query(
          `UPDATE bot_lotes SET ncantidad = ncantidad + $1, nalmacen_id = $2, tmodifi = NOW()
           WHERE nid = $3`,
          [cantidad, almacenDestinoId, loteId],
        )
      } else {
        await client.query(
          `INSERT INTO bot_lotes
           (nproducto_id, ccodigo_lote, dfechavencimiento, ncantidad, ncantidad_inicial, nalmacen_id, cnotas)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            productoId, `DEV-${Date.now()}`,
            new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0],
            cantidad, cantidad, almacenDestinoId,
            `Devolución cliente: ${motivo}`,
          ],
        )
      }

      // Movimiento
      await client.query(
        `INSERT INTO bot_movimientos_almacen
         (nproducto_id, nlote_id, nalmacen_destino_id, ctipo_movimiento, ncantidad, cdetalle, nusuario_id, cusuario)
         VALUES ($1, $2, $3, 'DEVOLUCION_CLIENTE', $4, $5, $6, $7)`,
        [productoId, loteId > 0 ? loteId : null, almacenDestinoId, cantidad, motivo, user.id, user.nombre],
      )

      // Kardex
      await client.query(
        `INSERT INTO bot_kardex
         (nproducto_id, nlote_id, ctipo, cref_tabla, ncantidad,
          nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
         VALUES ($1, $2, 'DEVOLUCION_CLIENTE', 'bot_movimientos_almacen', $3, $4, $5, $6, $7, $8, $9)`,
        [
          productoId, loteId > 0 ? loteId : null,
          cantidad, stockPrev, stockPrev + cantidad,
          `Devolución cliente → ${almNombre}: ${motivo}`,
          user.id, user.nombre, almacenDestinoId,
        ],
      )

      await client.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, cdetalle)
         VALUES ($1, $2, 'DEVOLUCION_CLIENTE', 'bot_movimientos_almacen', $3)`,
        [user.id, user.nombre, `${productoId}: +${cantidad}u → ${almNombre} | ${motivo}`],
      )

      await client.query('COMMIT')
      return { ok: true, productoId, cantidad, almacen: almNombre }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  // ══════════════════════════════════════════════════════════
  // POST /traslados-almacen/devolucion-proveedor
  // Saca stock del almacén y lo marca como devuelto al proveedor
  // ══════════════════════════════════════════════════════════
  fastify.post('/devolucion-proveedor', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['devoluciones', 'traslados-almacen', 'almacenes'], {
      errorMessage: 'No tiene permisos para registrar devoluciones a proveedor',
    }))) {
      return
    }

    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      productoId?: number
      loteId?: number
      almacenOrigenId?: number
      cantidad?: number
      motivo?: string
    }

    const productoId = Number(body.productoId || 0)
    const loteId = Number(body.loteId || 0)
    const almacenOrigenId = Number(body.almacenOrigenId || 0)
    const cantidad = Number(body.cantidad || 0)
    const motivo = String(body.motivo || 'Devolución a proveedor').trim()

    if (productoId <= 0) return reply.code(400).send({ error: 'productoId requerido' })
    if (almacenOrigenId <= 0) return reply.code(400).send({ error: 'almacenOrigenId requerido' })
    if (cantidad <= 0) return reply.code(400).send({ error: 'cantidad debe ser > 0' })

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      const almResult = await client.query<{ cnombre: string }>(
        `SELECT cnombre FROM bot_almacenes WHERE nid = $1 AND cestado = 'A'`,
        [almacenOrigenId],
      )
      if (!almResult.rows[0]) {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'Almacén origen no encontrado o inactivo' })
      }
      const almNombre = almResult.rows[0].cnombre.trim()

      const prodResult = await client.query<{ nstock: number }>(
        'SELECT nstock FROM bot_productos WHERE nid = $1 FOR UPDATE',
        [productoId],
      )
      if (!prodResult.rows[0]) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'Producto no encontrado' })
      }
      const stockPrev = Number(prodResult.rows[0].nstock)

      if (loteId > 0) {
        const loteResult = await client.query(
          `SELECT ncantidad, nversion FROM bot_lotes
           WHERE nid = $1 AND nproducto_id = $2 AND nalmacen_id = $3 AND cestado = 'ACTIVO'
           FOR UPDATE`,
          [loteId, productoId, almacenOrigenId],
        )
        if (!loteResult.rows[0]) {
          await client.query('ROLLBACK')
          return reply.code(404).send({ error: 'Lote no encontrado en almacén origen' })
        }
        if (Number(loteResult.rows[0].ncantidad) < cantidad) {
          await client.query('ROLLBACK')
          return reply.code(400).send({ error: 'Stock insuficiente en lote' })
        }
        await client.query(
          `UPDATE bot_lotes SET ncantidad = ncantidad - $1, tmodifi = NOW(), nversion = nversion + 1
           WHERE nid = $2 AND nversion = $3`,
          [cantidad, loteId, loteResult.rows[0].nversion],
        )
      } else {
        // FEFO from origin
        const lotesResult = await client.query(
          `SELECT nid, ncantidad, nversion FROM bot_lotes
           WHERE nproducto_id = $1 AND nalmacen_id = $2 AND cestado = 'ACTIVO' AND ncantidad > 0
           ORDER BY dfechavencimiento ASC FOR UPDATE`,
          [productoId, almacenOrigenId],
        )
        let pendiente = cantidad
        for (const lote of lotesResult.rows as any[]) {
          if (pendiente <= 0) break
          const tomar = Math.min(Number(lote.ncantidad), pendiente)
          await client.query(
            `UPDATE bot_lotes SET ncantidad = ncantidad - $1, tmodifi = NOW(), nversion = nversion + 1
             WHERE nid = $2 AND nversion = $3`,
            [tomar, lote.nid, lote.nversion],
          )
          pendiente -= tomar
        }
        if (pendiente > 0) {
          await client.query('ROLLBACK')
          return reply.code(400).send({ error: `Stock insuficiente: faltan ${pendiente} unidades` })
        }
      }

      // Update producto stock
      await client.query(
        'UPDATE bot_productos SET nstock = nstock - $1, tmodifi = NOW() WHERE nid = $2',
        [cantidad, productoId],
      )

      // Movimiento
      await client.query(
        `INSERT INTO bot_movimientos_almacen
         (nproducto_id, nlote_id, nalmacen_origen_id, ctipo_movimiento, ncantidad, cdetalle, nusuario_id, cusuario)
         VALUES ($1, $2, $3, 'DEVOLUCION_PROVEEDOR', $4, $5, $6, $7)`,
        [productoId, loteId > 0 ? loteId : null, almacenOrigenId, cantidad, motivo, user.id, user.nombre],
      )

      // Kardex
      await client.query(
        `INSERT INTO bot_kardex
         (nproducto_id, nlote_id, ctipo, cref_tabla, ncantidad,
          nstock_anterior, nstock_nuevo, cdetalle, nusuario_id, cusuario, nalmacen_id)
         VALUES ($1, $2, 'DEVOLUCION_PROVEEDOR', 'bot_movimientos_almacen', $3, $4, $5, $6, $7, $8, $9)`,
        [
          productoId, loteId > 0 ? loteId : null,
          -cantidad, stockPrev, stockPrev - cantidad,
          `Devolución proveedor ← ${almNombre}: ${motivo}`,
          user.id, user.nombre, almacenOrigenId,
        ],
      )

      await client.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, cdetalle)
         VALUES ($1, $2, 'DEVOLUCION_PROVEEDOR', 'bot_movimientos_almacen', $3)`,
        [user.id, user.nombre, `${productoId}: -${cantidad}u ← ${almNombre} | ${motivo}`],
      )

      await client.query('COMMIT')
      return { ok: true, productoId, cantidad, almacenOrigen: almNombre }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })
}
