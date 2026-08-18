import type { FastifyInstance } from 'fastify'

const TIPOS_ALMACEN = [
  'DISPONIBLE',
  'CUARENTENA',
  'DEVOLUCION_CLIENTE',
  'DEVOLUCION_PROVEEDOR',
  'BAJA',
  'PROCEDIMIENTOS',
  'CONTROL_ESPECIAL',
] as const

export default async function almacenesRoutes(fastify: FastifyInstance) {
  // ── GET / ─ listar almacenes (filtro por local / tipo) ────
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request) => {
    const qs = request.query as { localId?: string; tipo?: string }
    const conditions = ["a.cestado = 'A'"]
    const params: unknown[] = []

    if (qs.localId) {
      params.push(Number(qs.localId))
      conditions.push(`a.nlocal_id = $${params.length}`)
    }
    if (qs.tipo) {
      params.push(qs.tipo.toUpperCase())
      conditions.push(`a.ctipo_almacen = $${params.length}`)
    }

    const { rows } = await fastify.db.query<{
      nid: number
      nlocal_id: number
      local_nombre: string
      local_tipo: string
      cnombre: string
      ccodigo: string
      ctipo_almacen: string
      bpermite_venta: boolean
      bpermite_consumo_clinico: boolean
      brequiere_revision: boolean
      cestado: string
      tcreado: string
      lotes_activos: string
      stock_total: string
    }>(`
      SELECT a.nid, a.nlocal_id,
             l.cnombre AS local_nombre, l.ctipo_local AS local_tipo,
             a.cnombre, a.ccodigo, a.ctipo_almacen,
             a.bpermite_venta, a.bpermite_consumo_clinico, a.brequiere_revision,
             a.cestado, a.tcreado::TEXT,
             COUNT(lo.nid) FILTER (WHERE lo.cestado = 'ACTIVO' AND lo.ncantidad > 0)::TEXT AS lotes_activos,
             COALESCE(SUM(lo.ncantidad) FILTER (WHERE lo.cestado = 'ACTIVO'), 0)::TEXT AS stock_total
      FROM bot_almacenes a
      JOIN bot_locales l ON l.nid = a.nlocal_id
      LEFT JOIN bot_lotes lo ON lo.nalmacen_id = a.nid
      WHERE ${conditions.join(' AND ')}
      GROUP BY a.nid, l.cnombre, l.ctipo_local
      ORDER BY a.nlocal_id, a.nid
    `, params)

    return rows.map((r) => ({
      id: r.nid,
      localId: r.nlocal_id,
      localNombre: r.local_nombre.trim(),
      localTipo: r.local_tipo.trim(),
      nombre: r.cnombre.trim(),
      codigo: r.ccodigo.trim(),
      tipoAlmacen: r.ctipo_almacen.trim(),
      permiteVenta: r.bpermite_venta,
      permiteConsumoClinico: r.bpermite_consumo_clinico,
      requiereRevision: r.brequiere_revision,
      estado: r.cestado.trim(),
      creado: r.tcreado,
      lotesActivos: Number(r.lotes_activos),
      stockTotal: Number(r.stock_total),
    }))
  })

  // ── POST / ─ crear o editar almacén ───────────────────────
  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      id?: number
      localId?: number
      nombre?: string
      codigo?: string
      tipoAlmacen?: string
      permiteVenta?: boolean
      permiteConsumoClinico?: boolean
      requiereRevision?: boolean
    }

    const localId = Number(body.localId || 0)
    const nombre = String(body.nombre || '').trim()
    const codigo = String(body.codigo || '').trim()
    const tipoAlmacen = String(body.tipoAlmacen || '').trim().toUpperCase()
    const permiteVenta = body.permiteVenta === true
    const permiteConsumoClinico = body.permiteConsumoClinico === true
    const requiereRevision = body.requiereRevision === true

    if (!nombre) return reply.code(400).send({ error: 'Nombre es obligatorio' })
    if (!codigo) return reply.code(400).send({ error: 'Código es obligatorio' })
    if (!TIPOS_ALMACEN.includes(tipoAlmacen as typeof TIPOS_ALMACEN[number])) {
      return reply.code(400).send({ error: `Tipo inválido. Valores: ${TIPOS_ALMACEN.join(', ')}` })
    }

    // Validate localId exists
    if (localId > 0) {
      const loc = await fastify.db.query(
        "SELECT nid FROM bot_locales WHERE nid = $1 AND cestado = 'A'",
        [localId],
      )
      if (!loc.rows.length) return reply.code(400).send({ error: 'Local no encontrado' })
    } else {
      return reply.code(400).send({ error: 'Local es obligatorio' })
    }

    if (body.id) {
      // Check not used before inactivate (soft delete guard handled at app level, not here)
      const dup = await fastify.db.query(
        'SELECT nid FROM bot_almacenes WHERE ccodigo = $1 AND nid != $2',
        [codigo, body.id],
      )
      if (dup.rows.length) return reply.code(409).send({ error: 'Código duplicado' })

      await fastify.db.query(
        `UPDATE bot_almacenes
         SET nlocal_id = $1, cnombre = $2, ccodigo = $3, ctipo_almacen = $4,
             bpermite_venta = $5, bpermite_consumo_clinico = $6, brequiere_revision = $7,
             tmodifi = NOW()
         WHERE nid = $8`,
        [localId, nombre, codigo, tipoAlmacen, permiteVenta, permiteConsumoClinico, requiereRevision, body.id],
      )
      return { ok: true, id: body.id }
    }

    // Create
    const dup = await fastify.db.query('SELECT nid FROM bot_almacenes WHERE ccodigo = $1', [codigo])
    if (dup.rows.length) return reply.code(409).send({ error: 'Código duplicado' })

    const res = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_almacenes
       (nlocal_id, cnombre, ccodigo, ctipo_almacen, bpermite_venta, bpermite_consumo_clinico, brequiere_revision)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING nid`,
      [localId, nombre, codigo, tipoAlmacen, permiteVenta, permiteConsumoClinico, requiereRevision],
    )
    return { ok: true, id: res.rows[0].nid }
  })

  // ── GET /stock ─ stock por producto/almacén ───────────────
  fastify.get('/stock', { preHandler: fastify.requireAuth }, async (request) => {
    const qs = request.query as { localId?: string; almacenId?: string; soloVendible?: string }
    const conditions: string[] = []
    const params: unknown[] = []

    if (qs.localId) {
      params.push(Number(qs.localId))
      conditions.push(`local_id = $${params.length}`)
    }
    if (qs.almacenId) {
      params.push(Number(qs.almacenId))
      conditions.push(`almacen_id = $${params.length}`)
    }
    if (qs.soloVendible === 'true') {
      conditions.push('bpermite_venta = TRUE')
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const { rows } = await fastify.db.query(
      `SELECT * FROM vw_stock_por_almacen ${where} ORDER BY local_nombre, almacen_nombre, producto_nombre`,
      params,
    )
    return rows
  })
}
