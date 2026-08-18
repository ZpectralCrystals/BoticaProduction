import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

const METODOS_PAGO = new Set(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE', 'PLIN', 'OTRO'])
const PERMISSION_ERROR = 'No tienes permiso para realizar esta acción.'
const CXP_READ_PERMISSIONS = ['cxp_ver']
const CXP_PAY_PERMISSIONS = ['cxp_pagar']

export default async function cxpRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  async function requireCxpPermission(
    request: Parameters<FastifyInstance['requireAnyPermission']>[0],
    reply: Parameters<FastifyInstance['requireAnyPermission']>[1],
    permissions: string[],
  ) {
    return fastify.requireAnyPermission(request, reply, permissions, {
      errorMessage: PERMISSION_ERROR,
    })
  }

  // GET / — listado de CXP con filtros (estado, proveedor)
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    if (!(await requireCxpPermission(request, reply, CXP_READ_PERMISSIONS))) return

    const query = request.query as { estado?: string; proveedorId?: string; vencidas?: string }
    const conditions: string[] = []
    const params: unknown[] = []

    if (query.estado) {
      conditions.push(`x.cestado = $${params.length + 1}`)
      params.push(String(query.estado).toUpperCase())
    }
    if (query.proveedorId) {
      conditions.push(`x.nproveedor_id = $${params.length + 1}::INT`)
      params.push(Number(query.proveedorId))
    }
    if (query.vencidas === 'true') {
      conditions.push(`x.tfecha_vencimiento < CURRENT_DATE AND x.cestado IN ('PENDIENTE','PARCIAL')`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const result = await fastify.db.query<{
      nid: number
      ncompra_id: number
      compra_codigo: string | null
      nproveedor_id: number
      proveedor_nombre: string | null
      nmonto_total: string
      nmonto_pagado: string
      nsaldo: string
      tfecha_emision: string
      tfecha_vencimiento: string | null
      cestado: string
      cdocumento: string | null
      dias_atraso: number | null
    }>(
      `SELECT x.nid, x.ncompra_id,
              c.ccodigo            AS compra_codigo,
              x.nproveedor_id,
              p.cnombre            AS proveedor_nombre,
              x.nmonto_total::TEXT, x.nmonto_pagado::TEXT, x.nsaldo::TEXT,
              x.tfecha_emision::TEXT,
              x.tfecha_vencimiento::TEXT,
              x.cestado,
              x.cdocumento,
              CASE
                WHEN x.tfecha_vencimiento IS NULL THEN NULL
                WHEN x.cestado = 'PAGADA' THEN 0
                ELSE (CURRENT_DATE - x.tfecha_vencimiento)
              END AS dias_atraso
       FROM bot_cuentas_por_pagar x
       LEFT JOIN bot_compras      c ON c.nid = x.ncompra_id
       LEFT JOIN bot_proveedores  p ON p.nid = x.nproveedor_id
       ${where}
       ORDER BY x.cestado <> 'PAGADA' DESC, x.tfecha_vencimiento ASC NULLS LAST, x.tcreado DESC
       LIMIT 200`,
      params,
    )

    return result.rows.map((row) => ({
      nid: String(row.nid),
      compraId: String(row.ncompra_id),
      compraCodigo: row.compra_codigo,
      proveedorId: String(row.nproveedor_id),
      proveedorNombre: row.proveedor_nombre?.trim() ?? null,
      montoTotal: Number(row.nmonto_total || 0),
      montoPagado: Number(row.nmonto_pagado || 0),
      saldo: Number(row.nsaldo || 0),
      fechaEmision: row.tfecha_emision,
      fechaVencimiento: row.tfecha_vencimiento,
      estado: row.cestado,
      documento: row.cdocumento,
      diasAtraso: row.dias_atraso !== null ? Number(row.dias_atraso) : null,
    }))
  })

  // GET /resumen — saldos agregados por proveedor
  fastify.get('/resumen', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    if (!(await requireCxpPermission(request, reply, CXP_READ_PERMISSIONS))) return

    const result = await fastify.db.query<{
      nproveedor_id: number
      proveedor_nombre: string | null
      saldo_total: string
      vencidas: string
    }>(
      `SELECT x.nproveedor_id,
              p.cnombre AS proveedor_nombre,
              COALESCE(SUM(x.nsaldo), 0)::TEXT AS saldo_total,
              COALESCE(SUM(CASE
                WHEN x.tfecha_vencimiento < CURRENT_DATE AND x.cestado IN ('PENDIENTE','PARCIAL')
                THEN x.nsaldo ELSE 0
              END), 0)::TEXT AS vencidas
       FROM bot_cuentas_por_pagar x
       LEFT JOIN bot_proveedores p ON p.nid = x.nproveedor_id
       WHERE x.cestado IN ('PENDIENTE','PARCIAL')
       GROUP BY x.nproveedor_id, p.cnombre
       HAVING COALESCE(SUM(x.nsaldo), 0) > 0
       ORDER BY COALESCE(SUM(x.nsaldo), 0) DESC`,
    )

    return result.rows.map((row) => ({
      proveedorId: String(row.nproveedor_id),
      proveedorNombre: row.proveedor_nombre?.trim() ?? null,
      saldoTotal: Number(row.saldo_total || 0),
      vencido: Number(row.vencidas || 0),
    }))
  })

  // GET /:id — detalle CXP + historial de pagos
  fastify.get('/:id', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    if (!(await requireCxpPermission(request, reply, CXP_READ_PERMISSIONS))) return

    const { id } = request.params as { id: string }
    const cxpId = Number(id)
    if (!cxpId) return reply.code(400).send({ error: 'ID inválido' })

    const cxpResult = await fastify.db.query(
      `SELECT x.*, c.ccodigo AS compra_codigo, p.cnombre AS proveedor_nombre
       FROM bot_cuentas_por_pagar x
       LEFT JOIN bot_compras      c ON c.nid = x.ncompra_id
       LEFT JOIN bot_proveedores  p ON p.nid = x.nproveedor_id
       WHERE x.nid = $1`,
      [cxpId],
    )
    if (!cxpResult.rows[0]) {
      return reply.code(404).send({ error: 'CXP no encontrada' })
    }

    const pagosResult = await fastify.db.query(
      `SELECT pc.nid, pc.nmonto::TEXT, pc.cmetodo_pago, pc.cdocumento, pc.cnotas,
              pc.cusuario, pc.tcreado::TEXT, pc.ncaja_movimiento_id
       FROM bot_pagos_compras pc
       WHERE pc.ncxp_id = $1 AND pc.cestado = 'A'
       ORDER BY pc.tcreado ASC`,
      [cxpId],
    )

    return {
      cxp: cxpResult.rows[0],
      pagos: pagosResult.rows,
    }
  })

  // POST /:id/pagar — registrar pago, descuenta de caja
  fastify.post('/:id/pagar', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    if (!(await requireCxpPermission(request, reply, CXP_PAY_PERMISSIONS))) return

    const { id } = request.params as { id: string }
    const cxpId = Number(id)
    if (!cxpId) return reply.code(400).send({ error: 'ID inválido' })

    const body = request.body as {
      monto?: number
      metodoPago?: string
      documento?: string
      notas?: string
    }

    const monto = Number(body.monto || 0)
    const metodoPago = String(body.metodoPago || 'EFECTIVO').trim().toUpperCase()
    const documento = String(body.documento || '').trim() || null
    const notas = String(body.notas || '').trim() || null

    if (!Number.isFinite(monto) || monto <= 0) {
      return reply.code(400).send({ message: 'El monto debe ser mayor a 0' })
    }
    if (!METODOS_PAGO.has(metodoPago)) {
      return reply.code(400).send({ message: 'Método de pago inválido' })
    }

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')

      // Validar caja abierta (siempre exigible para método EFECTIVO; opcional para otros)
      let cajaMovimientoId: number | null = null
      const cajaResult = await client.query<{ nid: number }>(
        `SELECT nid FROM bot_caja
         WHERE cestado = 'A' AND nusuario_id = $1
         ORDER BY tapertura DESC LIMIT 1 FOR UPDATE`,
        [user.id],
      )
      const cajaId = cajaResult.rows[0]?.nid
      if (!cajaId && metodoPago === 'EFECTIVO') {
        await client.query('ROLLBACK')
        return reply.code(400).send({ error: 'Debe abrir caja para registrar pagos en efectivo' })
      }

      // Cargar CXP para descripción del movimiento
      const cxpRow = await client.query<{ ncompra_id: number; compra_codigo: string; proveedor: string }>(
        `SELECT x.ncompra_id, c.ccodigo AS compra_codigo, p.cnombre AS proveedor
         FROM bot_cuentas_por_pagar x
         LEFT JOIN bot_compras c     ON c.nid = x.ncompra_id
         LEFT JOIN bot_proveedores p ON p.nid = x.nproveedor_id
         WHERE x.nid = $1
         FOR UPDATE OF x`,
        [cxpId],
      )
      const cxp = cxpRow.rows[0]
      if (!cxp) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'CXP no encontrada' })
      }
      const descripcion = `Pago factura ${cxp.compra_codigo || `#${cxp.ncompra_id}`} a ${String(cxp.proveedor || '').trim()}`

      if (cajaId) {
        const movInsert = await client.query<{ nid: number }>(
          `INSERT INTO bot_caja_movimientos
             (ncaja_id, ctipo, nmonto, cmetodo_pago, cref_tabla, nref_id, cdescripcion, nusuario_id, cusuario)
           VALUES ($1, 'PAGO_FACTURA', $2, $3, 'bot_cuentas_por_pagar', $4, $5, $6, $7)
           RETURNING nid`,
          [cajaId, monto, metodoPago, cxpId, descripcion, user.id, user.nombre],
        )
        cajaMovimientoId = movInsert.rows[0]?.nid ?? null
      }

      // Aplicar pago vía función helper
      const pagoResult = await client.query<{ pago_id: number }>(
        `SELECT fn_aplicar_pago_cxp($1::INT, $2::NUMERIC, $3::VARCHAR, $4::INT, $5::VARCHAR, $6::TEXT, $7::INT, $8::VARCHAR) AS pago_id`,
        [cxpId, monto, metodoPago, cajaMovimientoId, documento, notas, user.id, user.nombre],
      )

      await client.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'PAGO_CXP', 'bot_pagos_compras', $3, $4)`,
        [user.id, user.nombre, pagoResult.rows[0]?.pago_id, `${descripcion} S/${monto} (${metodoPago})`],
      )

      await client.query('COMMIT')
      return { ok: true, pagoId: String(pagoResult.rows[0]?.pago_id), cajaMovimientoId: cajaMovimientoId ? String(cajaMovimientoId) : null }
    } catch (error) {
      await client.query('ROLLBACK')
      const message = error instanceof Error ? error.message : 'Error registrando pago'
      request.log.error({ error }, 'Error registrando pago CXP')
      return reply.code(400).send({ error: 'PAGO_CXP_ERROR', message })
    } finally {
      client.release()
    }
  })
}
