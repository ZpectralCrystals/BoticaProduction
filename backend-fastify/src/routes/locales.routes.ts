import type { FastifyInstance } from 'fastify'

const TIPOS_LOCAL = ['BOTICA', 'CLINICA', 'OTRO'] as const

export default async function localesRoutes(fastify: FastifyInstance) {
  // ── GET / ─ listar locales activos ────────────────────────
  fastify.get('/', { preHandler: fastify.requireAuth }, async () => {
    const { rows } = await fastify.db.query<{
      nid: number
      cnombre: string
      ccodigo: string
      ctipo_local: string
      cdireccion: string | null
      ctelefono: string | null
      cestado: string
      tcreado: string
      almacenes_count: string
    }>(`
      SELECT l.nid, l.cnombre, l.ccodigo, l.ctipo_local, l.cdireccion, l.ctelefono,
             l.cestado, l.tcreado::TEXT,
             COUNT(a.nid)::TEXT AS almacenes_count
      FROM bot_locales l
      LEFT JOIN bot_almacenes a ON a.nlocal_id = l.nid AND a.cestado = 'A'
      WHERE l.cestado = 'A'
      GROUP BY l.nid
      ORDER BY l.nid
    `)
    return rows.map((r) => ({
      id: r.nid,
      nombre: r.cnombre.trim(),
      codigo: r.ccodigo.trim(),
      tipoLocal: r.ctipo_local.trim(),
      direccion: r.cdireccion?.trim() || '',
      telefono: r.ctelefono?.trim() || '',
      estado: r.cestado.trim(),
      creado: r.tcreado,
      almacenesCount: Number(r.almacenes_count),
    }))
  })

  // ── POST / ─ crear o editar local ─────────────────────────
  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const body = request.body as {
      id?: number
      nombre?: string
      codigo?: string
      tipoLocal?: string
      direccion?: string
      telefono?: string
    }

    const nombre = String(body.nombre || '').trim()
    const codigo = String(body.codigo || '').trim()
    const tipoLocal = String(body.tipoLocal || 'BOTICA').trim().toUpperCase()
    const direccion = String(body.direccion || '').trim()
    const telefono = String(body.telefono || '').trim()

    if (!nombre) return reply.code(400).send({ error: 'Nombre es obligatorio' })
    if (!codigo) return reply.code(400).send({ error: 'Código es obligatorio' })
    if (!TIPOS_LOCAL.includes(tipoLocal as typeof TIPOS_LOCAL[number])) {
      return reply.code(400).send({ error: `Tipo de local inválido. Valores: ${TIPOS_LOCAL.join(', ')}` })
    }

    if (body.id) {
      // Update
      const dup = await fastify.db.query(
        'SELECT nid FROM bot_locales WHERE ccodigo = $1 AND nid != $2',
        [codigo, body.id],
      )
      if (dup.rows.length) return reply.code(409).send({ error: 'Código duplicado' })

      await fastify.db.query(
        `UPDATE bot_locales
         SET cnombre = $1, ccodigo = $2, ctipo_local = $3, cdireccion = $4, ctelefono = $5, tmodifi = NOW()
         WHERE nid = $6`,
        [nombre, codigo, tipoLocal, direccion, telefono, body.id],
      )
      return { ok: true, id: body.id }
    }

    // Create
    const dup = await fastify.db.query('SELECT nid FROM bot_locales WHERE ccodigo = $1', [codigo])
    if (dup.rows.length) return reply.code(409).send({ error: 'Código duplicado' })

    const res = await fastify.db.query<{ nid: number }>(
      `INSERT INTO bot_locales (cnombre, ccodigo, ctipo_local, cdireccion, ctelefono)
       VALUES ($1, $2, $3, $4, $5) RETURNING nid`,
      [nombre, codigo, tipoLocal, direccion, telefono],
    )
    return { ok: true, id: res.rows[0].nid }
  })
}
