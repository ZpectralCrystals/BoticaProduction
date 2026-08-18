import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

function canManageCaja(user: { super?: boolean; admin?: boolean } | null) {
  return Boolean(user?.super || user?.admin)
}

function hasCajaPermission(user: { permisos?: string[] } | null, permission: string) {
  return Boolean(user?.permisos?.includes(permission))
}

type CajaAbiertaRow = {
  nid: number
  ccaja: string
  napertura: string
  tapertura: string
  nusuario_id: number | null
  usuario_nombre: string | null
}

function mapCajaAbierta(row: CajaAbiertaRow) {
  return {
    nid: String(row.nid),
    ccaja: row.ccaja.trim(),
    napertura: row.napertura,
    tapertura: row.tapertura,
    usuarioId: row.nusuario_id ? String(row.nusuario_id) : null,
    usuarioNombre: row.usuario_nombre?.trim() || null,
  }
}

export default async function cajaRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const [cajaAbiertaResult, cajasAbiertasResult, ventasHoyResult, desgloseResult, historialResult] = await Promise.all([
      fastify.db.query<CajaAbiertaRow>(
        `SELECT c.nid, c.ccaja, c.napertura::TEXT, c.tapertura::TEXT,
                c.nusuario_id, u.cnombre AS usuario_nombre
         FROM bot_caja c
         LEFT JOIN bot_usuarios u ON u.nid = c.nusuario_id
         WHERE c.cestado = 'A'
           AND c.nusuario_id = $1
         ORDER BY c.tapertura DESC
         LIMIT 1`,
        [user.id],
      ),
      fastify.db.query<CajaAbiertaRow>(
        `SELECT c.nid, c.ccaja, c.napertura::TEXT, c.tapertura::TEXT,
                c.nusuario_id, u.cnombre AS usuario_nombre
         FROM bot_caja c
         LEFT JOIN bot_usuarios u ON u.nid = c.nusuario_id
         WHERE c.cestado = 'A'
           AND (c.nusuario_id = $1 OR $2::BOOLEAN = TRUE)
         ORDER BY c.tapertura DESC
         LIMIT 50`,
        [user.id, canManageCaja(user)],
      ),
      fastify.db.query<{ total: string; n: string }>(
        `SELECT COALESCE(SUM(ntotal), 0)::text AS total, COUNT(*)::text AS n
         FROM bot_ventas
         WHERE tcreado::DATE = CURRENT_DATE`,
      ),
      fastify.db.query<{ cmetpago: string | null; total: string }>(
        `SELECT cmetpago, COALESCE(SUM(ntotal), 0)::text AS total
         FROM bot_ventas
         WHERE tcreado::DATE = CURRENT_DATE
         GROUP BY cmetpago`,
      ),
      fastify.db.query<{
        nid: number
        ccaja: string
        napertura: string
        ncierre: string | null
        nventas_total: string
        ningresos_total: string
        negresos_total: string
        npagos_factura_total: string
        ngastos_total: string
        nsaldo_esperado: string
        ndiferencia: string
        cestado: string
        tapertura: string
        tcierre: string | null
        cnombre: string | null
        ccerrado_por: string | null
      }>(
        `SELECT c.nid, c.ccaja, c.napertura::TEXT, c.ncierre::TEXT,
                COALESCE(c.nventas_total, 0)::TEXT AS nventas_total,
                COALESCE(c.ningresos_total, 0)::TEXT AS ningresos_total,
                COALESCE(c.negresos_total, 0)::TEXT AS negresos_total,
                COALESCE(c.npagos_factura_total, 0)::TEXT AS npagos_factura_total,
                COALESCE(c.ngastos_total, 0)::TEXT AS ngastos_total,
                COALESCE(c.nsaldo_esperado, 0)::TEXT AS nsaldo_esperado,
                COALESCE(c.ndiferencia, 0)::TEXT AS ndiferencia,
                c.cestado, c.tapertura::TEXT, c.tcierre::TEXT, u.cnombre, c.ccerrado_por
         FROM bot_caja c
         LEFT JOIN bot_usuarios u ON u.nid = c.nusuario_id
         ORDER BY c.tapertura DESC
         LIMIT 10`,
      ),
    ])

    const desglose = Object.fromEntries(
      desgloseResult.rows.map((row) => [String(row.cmetpago || '').trim(), Number(row.total || 0)]),
    )

    return {
      cajaAbierta: cajaAbiertaResult.rows[0] ? mapCajaAbierta(cajaAbiertaResult.rows[0]) : null,
      cajasAbiertas: cajasAbiertasResult.rows.map(mapCajaAbierta),
      ventasHoy: {
        total: Number(ventasHoyResult.rows[0]?.total || 0),
        cantidad: Number(ventasHoyResult.rows[0]?.n || 0),
      },
      desglose,
      historial: historialResult.rows.map((row) => ({
        nid: String(row.nid),
        ccaja: row.ccaja.trim(),
        napertura: row.napertura,
        ncierre: row.ncierre,
        ventasTotal: Number(row.nventas_total || 0),
        ingresosTotal: Number(row.ningresos_total || 0),
        egresosTotal: Number(row.negresos_total || 0),
        pagosFacturaTotal: Number(row.npagos_factura_total || 0),
        gastosTotal: Number(row.ngastos_total || 0),
        saldoEsperado: Number(row.nsaldo_esperado || 0),
        diferencia: Number(row.ndiferencia || 0),
        cestado: row.cestado,
        tapertura: row.tapertura,
        tcierre: row.tcierre,
        cnombre: String(row.cnombre || '').trim(),
        cerradoPor: String(row.ccerrado_por || '').trim() || null,
      })),
    }
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      action?: string
      montoApertura?: number
      montoCierre?: number
      caja?: string
      usuarioId?: number
      cajaId?: number
    }

    if (body.action === 'abrir') {
      if (!canManageCaja(user)) {
        return reply.code(403).send({ error: 'SOLO ADMINISTRADOR PUEDE ABRIR CAJA' })
      }

      const usuarioAsignadoId = Number(body.usuarioId || 0)
      if (!Number.isInteger(usuarioAsignadoId) || usuarioAsignadoId <= 0) {
        return reply.code(400).send({ error: 'USUARIO ASIGNADO OBLIGATORIO' })
      }

      const usuarioAsignadoResult = await fastify.db.query<{ nid: number; cnombre: string }>(
        `SELECT nid, cnombre
         FROM bot_usuarios
         WHERE nid = $1 AND cestado = 'A'
         LIMIT 1`,
        [usuarioAsignadoId],
      )
      const usuarioAsignado = usuarioAsignadoResult.rows[0]
      if (!usuarioAsignado) {
        return reply.code(400).send({ error: 'USUARIO ASIGNADO NO ENCONTRADO' })
      }

      const abiertaResult = await fastify.db.query<{ nid: number }>(
        `SELECT nid
         FROM bot_caja
         WHERE cestado = 'A' AND nusuario_id = $1`,
        [usuarioAsignadoId],
      )

      if (abiertaResult.rows[0]) {
        return reply.code(400).send({ error: 'USUARIO YA TIENE UNA CAJA ABIERTA' })
      }

      const monto = Number(body.montoApertura || 0)
      const caja = String(body.caja || 'Caja principal').trim() || 'Caja principal'

      const insertResult = await fastify.db.query<{ nid: number }>(
        `INSERT INTO bot_caja (ccaja, napertura, nusuario_id)
         VALUES ($1, $2, $3)
         RETURNING nid`,
        [caja, monto, usuarioAsignadoId],
      )

      const cajaId = insertResult.rows[0]?.nid
      await fastify.db.query(
        `INSERT INTO bot_auditoria
         (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'APERTURA_CAJA', 'bot_caja', $3, $4)`,
        [
          user.id,
          user.nombre,
          cajaId,
          `Apertura con S/${monto}; asignada a ${usuarioAsignado.cnombre.trim()} (${usuarioAsignadoId})`,
        ],
      )

      return {
        ok: true,
        id: String(cajaId),
        usuarioId: String(usuarioAsignadoId),
        usuarioNombre: usuarioAsignado.cnombre.trim(),
      }
    }

    if (body.action === 'cerrar') {
      if (!canManageCaja(user)) {
        return reply.code(403).send({ error: 'NO TIENE PERMISO PARA CERRAR CAJA' })
      }

      const client = await fastify.db.connect()
      try {
        await client.query('BEGIN')

        const cajaId = Number(body.cajaId || 0)
        if (!Number.isInteger(cajaId) || cajaId <= 0) {
          await client.query('ROLLBACK')
          return reply.code(400).send({ error: 'CAJA A CERRAR OBLIGATORIA' })
        }

        const cajaResult = await client.query<{ nid: number; napertura: string; nusuario_id: number | null }>(
          `SELECT nid, napertura::TEXT, nusuario_id
           FROM bot_caja
           WHERE cestado = 'A' AND nid = $1
           ORDER BY tapertura DESC
           LIMIT 1
           FOR UPDATE`,
          [cajaId],
        )

        const caja = cajaResult.rows[0]
        if (!caja) {
          await client.query('ROLLBACK')
          return reply.code(400).send({ error: 'NO HAY CAJA ABIERTA' })
        }

        const movSummary = await client.query<{ ctipo: string; total: string }>(
          `SELECT ctipo, COALESCE(SUM(nmonto), 0)::TEXT AS total
           FROM bot_caja_movimientos
           WHERE ncaja_id = $1 AND cestado = 'A'
           GROUP BY ctipo`,
          [caja.nid],
        )
        const ventasResult = await client.query<{ efectivo: string; digital: string; total: string }>(
          `SELECT
             COALESCE(SUM(
               CASE
                 WHEN COALESCE(nmonto_efectivo, 0) = 0
                  AND COALESCE(nmonto_digital, 0) = 0
                  AND cmetpago = 'Efectivo'
                   THEN ntotal
                 ELSE GREATEST(COALESCE(nmonto_efectivo, 0) - COALESCE(nvuelto, 0), 0)
               END
             ), 0)::TEXT AS efectivo,
             COALESCE(SUM(nmonto_digital), 0)::TEXT AS digital,
             COALESCE(SUM(ntotal), 0)::TEXT AS total
           FROM bot_ventas
           WHERE tcreado >= (SELECT tapertura FROM bot_caja WHERE nid = $1)
             AND nusuario_id = $2
             AND cestado = 'A'`,
          [caja.nid, caja.nusuario_id],
        )

        const detalle: Record<string, number> = {}
        for (const row of movSummary.rows) {
          detalle[row.ctipo] = Number(row.total || 0)
        }
        const apertura = Number(caja.napertura || 0)
        const ventas = Number(ventasResult.rows[0]?.efectivo ?? ventasResult.rows[0]?.total ?? 0)
        const ventasTotal = Number(ventasResult.rows[0]?.total || ventas)
        const ventasDigital = Number(ventasResult.rows[0]?.digital || 0)
        const ingresos = detalle.INGRESO || 0
        const egresosManuales = detalle.EGRESO || 0
        const gastos = detalle.GASTO || 0
        const pagosFactura = detalle.PAGO_FACTURA || 0
        const egresos = egresosManuales + gastos + pagosFactura
        const saldoEsperado = apertura + ventas + ingresos - egresos
        const montoCierre = saldoEsperado
        const diferencia = 0

        await client.query(
          `UPDATE bot_caja
           SET ncierre = $1,
               cestado = 'C',
               tcierre = NOW(),
               nventas_total = $2,
               ningresos_total = $3,
               negresos_total = $4,
               npagos_factura_total = $5,
               ngastos_total = $6,
               nsaldo_esperado = $7,
               ndiferencia = $8,
               ncerrado_por_id = $9,
               ccerrado_por = $10
           WHERE nid = $11`,
          [
            montoCierre,
            ventas,
            ingresos,
            egresosManuales,
            pagosFactura,
            gastos,
            saldoEsperado,
            diferencia,
            user.id,
            user.nombre,
            caja.nid,
          ],
        )

        await client.query(
          `INSERT INTO bot_auditoria
           (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
           VALUES ($1, $2, 'CIERRE_CAJA', 'bot_caja', $3, $4)`,
          [
            user.id,
            user.nombre,
            caja.nid,
            `Cierre automatico S/${montoCierre.toFixed(2)}; esperado S/${saldoEsperado.toFixed(2)}; diferencia S/${diferencia.toFixed(2)}`,
          ],
        )

        await client.query('COMMIT')
        return {
          ok: true,
          id: String(caja.nid),
          resumen: {
            apertura,
            ventas,
            ventasTotal,
            ventasDigital,
            ingresos,
            egresosManuales,
            pagosFactura,
            gastos,
            egresos,
            saldoEsperado,
            montoCierre,
            cierreAutomatico: true,
            diferencia,
            detalle,
          },
        }
      } catch (error) {
        await client.query('ROLLBACK')
        request.log.error({ error }, 'Error cerrando caja')
        return reply.code(500).send({ error: 'NO SE PUDO CERRAR CAJA' })
      } finally {
        client.release()
      }
    }

    return reply.code(400).send({ error: 'ACCION NO VALIDA' })
  })

  // ─── Movimientos detallados (egresos/ingresos/gastos/pago_factura) ──────────

  const MOV_TIPOS_USUARIO = new Set(['INGRESO', 'EGRESO', 'GASTO', 'PAGO_FACTURA'])
  const MOV_METODOS = new Set(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE', 'PLIN', 'OTRO'])

  fastify.get('/movimientos', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    const query = request.query as { cajaId?: string; tipo?: string }

    const conditions: string[] = ['m.cestado = $1']
    const params: unknown[] = ['A']

    if (query.cajaId) {
      conditions.push(`m.ncaja_id = $${params.length + 1}::INT`)
      params.push(Number(query.cajaId))
      if (!canManageCaja(user)) {
        conditions.push(`m.ncaja_id IN (
          SELECT nid FROM bot_caja WHERE nusuario_id = $${params.length + 1}
        )`)
        params.push(user.id)
      }
    } else {
      // Por defecto, caja abierta asignada al usuario; admin ve la última caja abierta.
      conditions.push(`m.ncaja_id IN (
        SELECT nid FROM bot_caja
        WHERE cestado = 'A'
          AND (nusuario_id = $${params.length + 1} OR $${params.length + 2}::BOOLEAN = TRUE)
        ORDER BY tapertura DESC
        LIMIT 1
      )`)
      params.push(user.id)
      params.push(canManageCaja(user))
    }

    if (query.tipo && MOV_TIPOS_USUARIO.has(query.tipo)) {
      conditions.push(`m.ctipo = $${params.length + 1}`)
      params.push(query.tipo)
    }

    const result = await fastify.db.query<{
      nid: number
      ncaja_id: number
      ctipo: string
      nmonto: string
      cmetodo_pago: string
      cref_tabla: string | null
      nref_id: number | null
      cdescripcion: string | null
      cusuario: string | null
      tcreado: string
    }>(
      `SELECT m.nid, m.ncaja_id, m.ctipo, m.nmonto::TEXT, m.cmetodo_pago,
              m.cref_tabla, m.nref_id, m.cdescripcion, m.cusuario, m.tcreado::TEXT
       FROM bot_caja_movimientos m
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.tcreado DESC
       LIMIT 100`,
      params,
    )

    return result.rows.map((row) => ({
      nid: String(row.nid),
      cajaId: String(row.ncaja_id),
      tipo: row.ctipo,
      monto: Number(row.nmonto || 0),
      metodoPago: row.cmetodo_pago,
      refTabla: row.cref_tabla,
      refId: row.nref_id ? String(row.nref_id) : null,
      descripcion: row.cdescripcion,
      usuario: row.cusuario,
      fecha: row.tcreado,
    }))
  })

  fastify.post('/movimientos', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      tipo?: string
      monto?: number
      metodoPago?: string
      descripcion?: string
      refTabla?: string
      refId?: number
      cajaId?: number
    }

    const tipo = String(body.tipo || '').trim().toUpperCase()
    const monto = Number(body.monto || 0)
    const metodoPago = String(body.metodoPago || 'EFECTIVO').trim().toUpperCase()
    const descripcion = String(body.descripcion || '').trim()

    if (!MOV_TIPOS_USUARIO.has(tipo)) {
      return reply.code(400).send({ message: 'Tipo de movimiento inválido (INGRESO|EGRESO|GASTO|PAGO_FACTURA)' })
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      return reply.code(400).send({ message: 'El monto debe ser mayor a 0' })
    }
    if (!MOV_METODOS.has(metodoPago)) {
      return reply.code(400).send({ message: 'Método de pago inválido' })
    }
    if (!descripcion) {
      return reply.code(400).send({ message: 'La descripción es obligatoria' })
    }

    const cajaIdSolicitada = Number(body.cajaId || 0)
    const cajaResult = cajaIdSolicitada > 0
      ? await fastify.db.query<{ nid: number }>(
          `SELECT nid FROM bot_caja
           WHERE cestado = 'A'
             AND nid = $1
             AND (nusuario_id = $2 OR $3::BOOLEAN = TRUE)
           ORDER BY tapertura DESC LIMIT 1`,
          [cajaIdSolicitada, user.id, canManageCaja(user)],
        )
      : await fastify.db.query<{ nid: number }>(
          `SELECT nid FROM bot_caja
           WHERE cestado = 'A'
             AND (nusuario_id = $1 OR $2::BOOLEAN = TRUE)
           ORDER BY tapertura DESC LIMIT 1`,
          [user.id, canManageCaja(user)],
        )
    const cajaId = cajaResult.rows[0]?.nid
    if (!cajaId) {
      return reply.code(400).send({ error: 'NO HAY CAJA ABIERTA' })
    }

    const insertResult = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_caja_movimientos
         (ncaja_id, ctipo, nmonto, cmetodo_pago, cref_tabla, nref_id, cdescripcion, nusuario_id, cusuario)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING nid`,
      [
        cajaId, tipo, monto, metodoPago,
        body.refTabla ? String(body.refTabla).trim() : null,
        body.refId ? Number(body.refId) : null,
        descripcion, user.id, user.nombre,
      ],
    )

    await fastify.db.query(
      `INSERT INTO bot_auditoria
         (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
       VALUES ($1, $2, $3, 'bot_caja_movimientos', $4, $5)`,
      [user.id, user.nombre, `CAJA_${tipo}`, insertResult.rows[0]?.nid, `${descripcion} S/${monto}`],
    )

    return { ok: true, id: String(insertResult.rows[0]?.nid) }
  })

  fastify.patch('/movimientos/:id/anular', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    if (!canManageCaja(user) && !hasCajaPermission(user, 'caja_anular')) {
      return reply.code(403).send({ error: 'NO TIENE PERMISO PARA ANULAR MOVIMIENTOS DE CAJA' })
    }

    const { id } = request.params as { id: string }
    const movimientoId = Number(id)
    const body = (request.body ?? {}) as { motivo?: string }
    const motivo = String(body.motivo || '').trim()

    if (!Number.isInteger(movimientoId) || movimientoId <= 0) {
      return reply.code(400).send({ error: 'ID DE MOVIMIENTO INVALIDO' })
    }
    if (!motivo) {
      return reply.code(400).send({ error: 'MOTIVO DE ANULACION OBLIGATORIO' })
    }

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      const movResult = await client.query<{
        nid: number
        ncaja_id: number
        ctipo: string
        nmonto: string
        cestado: string
        nusuario_id: number | null
        caja_usuario_id: number | null
      }>(
        `SELECT m.nid, m.ncaja_id, m.ctipo, m.nmonto::TEXT, m.cestado,
                m.nusuario_id, c.nusuario_id AS caja_usuario_id
         FROM bot_caja_movimientos m
         JOIN bot_caja c ON c.nid = m.ncaja_id
         WHERE m.nid = $1
         FOR UPDATE`,
        [movimientoId],
      )

      const mov = movResult.rows[0]
      if (!mov) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'MOVIMIENTO DE CAJA NO ENCONTRADO' })
      }
      if (mov.cestado !== 'A') {
        await client.query('ROLLBACK')
        return reply.code(409).send({ error: 'MOVIMIENTO YA ESTA ANULADO' })
      }
      if (!canManageCaja(user) && mov.caja_usuario_id !== user.id) {
        await client.query('ROLLBACK')
        return reply.code(403).send({ error: 'NO PUEDE ANULAR MOVIMIENTOS DE OTRA CAJA' })
      }

      await client.query(
        `UPDATE bot_caja_movimientos
         SET cestado = 'N',
             cdescripcion = LEFT(
               CONCAT(
                 COALESCE(cdescripcion, ''),
                 ' | ANULADO: ', $2::TEXT,
                 ' | usuario: ', $3::TEXT,
                 ' | fecha: ', NOW()::TEXT
               ),
               255
             )
         WHERE nid = $1`,
        [movimientoId, motivo, user.nombre],
      )

      await client.query(
        `INSERT INTO bot_auditoria
           (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'ANULA_CAJA_MOVIMIENTO', 'bot_caja_movimientos', $3, $4)`,
        [
          user.id,
          user.nombre,
          movimientoId,
          `Anulado movimiento ${mov.ctipo} S/${mov.nmonto}; motivo: ${motivo}`,
        ],
      )

      await client.query('COMMIT')
      return { ok: true, id: String(movimientoId), estado: 'ANULADO' }
    } catch (error) {
      await client.query('ROLLBACK')
      request.log.error({ error }, 'Error anulando movimiento de caja')
      return reply.code(500).send({ error: 'NO SE PUDO ANULAR MOVIMIENTO DE CAJA' })
    } finally {
      client.release()
    }
  })

  fastify.get('/resumen', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const query = request.query as { cajaId?: string }
    const cajaId = Number(query.cajaId || 0)
    const cajaResult = cajaId > 0
      ? await fastify.db.query<{
          nid: number
          napertura: string
          nusuario_id: number | null
          usuario_nombre: string | null
        }>(
          `SELECT c.nid, c.napertura::TEXT, c.nusuario_id, u.cnombre AS usuario_nombre
           FROM bot_caja c
           LEFT JOIN bot_usuarios u ON u.nid = c.nusuario_id
           WHERE c.cestado = 'A'
             AND c.nid = $1
             AND (c.nusuario_id = $2 OR $3::BOOLEAN = TRUE)
           ORDER BY c.tapertura DESC LIMIT 1`,
          [cajaId, user.id, canManageCaja(user)],
        )
      : await fastify.db.query<{
          nid: number
          napertura: string
          nusuario_id: number | null
          usuario_nombre: string | null
        }>(
          `SELECT c.nid, c.napertura::TEXT, c.nusuario_id, u.cnombre AS usuario_nombre
           FROM bot_caja c
           LEFT JOIN bot_usuarios u ON u.nid = c.nusuario_id
           WHERE c.cestado = 'A'
             AND (c.nusuario_id = $1 OR $2::BOOLEAN = TRUE)
           ORDER BY c.tapertura DESC LIMIT 1`,
          [user.id, canManageCaja(user)],
        )
    const caja = cajaResult.rows[0]
    if (!caja) {
      return { abierta: false }
    }

    const [movSummary, ventasResult] = await Promise.all([
      fastify.db.query<{ ctipo: string; total: string }>(
        `SELECT ctipo, COALESCE(SUM(nmonto), 0)::TEXT AS total
         FROM bot_caja_movimientos
         WHERE ncaja_id = $1 AND cestado = 'A'
         GROUP BY ctipo`,
        [caja.nid],
      ),
      fastify.db.query<{ efectivo: string; digital: string; total: string }>(
        `SELECT
           COALESCE(SUM(
             CASE
               WHEN COALESCE(nmonto_efectivo, 0) = 0
                AND COALESCE(nmonto_digital, 0) = 0
                AND cmetpago = 'Efectivo'
                 THEN ntotal
               ELSE GREATEST(COALESCE(nmonto_efectivo, 0) - COALESCE(nvuelto, 0), 0)
             END
           ), 0)::TEXT AS efectivo,
           COALESCE(SUM(nmonto_digital), 0)::TEXT AS digital,
           COALESCE(SUM(ntotal), 0)::TEXT AS total
         FROM bot_ventas
         WHERE tcreado >= (SELECT tapertura FROM bot_caja WHERE nid = $1)
           AND nusuario_id = $2
           AND cestado = 'A'`,
        [caja.nid, caja.nusuario_id],
      ),
    ])

    const totales: Record<string, number> = {}
    for (const row of movSummary.rows) {
      totales[row.ctipo] = Number(row.total || 0)
    }
    const apertura = Number(caja.napertura || 0)
    const ventas = Number(ventasResult.rows[0]?.efectivo ?? ventasResult.rows[0]?.total ?? 0)
    const ventasTotal = Number(ventasResult.rows[0]?.total || ventas)
    const ventasDigital = Number(ventasResult.rows[0]?.digital || 0)
    const ingresos = totales.INGRESO || 0
    const egresosManuales = totales.EGRESO || 0
    const gastos = totales.GASTO || 0
    const pagosFactura = totales.PAGO_FACTURA || 0
    const egresos = egresosManuales + gastos + pagosFactura
    const saldoTeorico = apertura + ventas + ingresos - egresos

    return {
      abierta: true,
      cajaId: String(caja.nid),
      usuarioId: caja.nusuario_id ? String(caja.nusuario_id) : null,
      usuarioNombre: caja.usuario_nombre?.trim() || null,
      apertura,
      ventas,
      ventasTotal,
      ventasDigital,
      ingresos,
      egresosManuales,
      pagosFactura,
      gastos,
      egresos,
      detalle: totales,
      saldoTeorico,
      saldoEsperado: saldoTeorico,
    }
  })
}
