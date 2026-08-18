import type { FastifyInstance, FastifyPluginOptions } from 'fastify'

function normalizeRuc(value: string) {
  return value.replace(/\D/g, '')
}

function normalizeProviderState(value: string) {
  const normalized = value.trim().toUpperCase()
  if (normalized === 'A' || normalized === 'ACTIVO') return 'A'
  if (normalized === 'I' || normalized === 'INACTIVO') return 'I'
  return null
}

function hasValidPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 6
}

function hasValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}

export default async function providersRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request) => {
    const query = request.query as { q?: string; includeInactive?: string | boolean }
    const filter = String(query.q || '').trim()
    const includeInactive = ['1', 'true', 'si', 'yes'].includes(String(query.includeInactive || '').trim().toLowerCase())
    const values: Array<string> = []
    let sql = `
      SELECT nid, cruc, cnombre, ccontacto, ctelefono, cemail, cdireccion, cnotas, cestado, tcreado::TEXT
      FROM bot_proveedores
      WHERE 1 = 1
    `

    if (!includeInactive) {
      sql += ` AND cestado = 'A'`
    }

    if (filter) {
      values.push(`%${filter}%`)
      values.push(`${filter}%`)
      sql += ` AND (cnombre ILIKE $${values.length - 1} OR cruc LIKE $${values.length})`
    }

    sql += ` ORDER BY CASE WHEN cestado = 'A' THEN 0 ELSE 1 END, cnombre`

    const result = await fastify.db.query(sql, values)
    return result.rows
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    if (!(await fastify.requireAnyPermission(request, reply, ['proveedores'], {
      errorMessage: 'No tiene permisos para crear o editar proveedores',
    }))) {
      return
    }

    const body = request.body as {
      id?: number
      nombre?: string
      ruc?: string
      contacto?: string
      telefono?: string
      email?: string
      direccion?: string
      notas?: string
      estado?: string
    }

    const nombre = String(body.nombre || '').trim()
    const ruc = normalizeRuc(String(body.ruc || '').trim())
    const contacto = String(body.contacto || '').trim()
    const telefono = String(body.telefono || '').trim()
    const email = String(body.email || '').trim()
    const direccion = String(body.direccion || '').trim()
    const notas = String(body.notas || '').trim()
    const estado = normalizeProviderState(String(body.estado || 'ACTIVO'))
    const providerId = Number(body.id || 0)

    if (!ruc || !nombre || !telefono || !contacto) {
      return reply.code(400).send({
        message: 'RUC, razón social, teléfono y contacto son obligatorios',
      })
    }

    if (!/^\d{11}$/.test(ruc)) {
      return reply.code(400).send({
        message: 'El RUC debe tener exactamente 11 dígitos',
      })
    }

    if (!hasValidPhone(telefono)) {
      return reply.code(400).send({
        message: 'El teléfono debe tener al menos 6 dígitos',
      })
    }

    if (email && !hasValidEmail(email)) {
      return reply.code(400).send({
        message: 'El email del proveedor no es válido',
      })
    }

    if (!estado) {
      return reply.code(400).send({
        message: 'El estado del proveedor debe ser ACTIVO o INACTIVO',
      })
    }

    const client = await fastify.db.connect()

    try {
      await client.query('BEGIN')

      const duplicate = await client.query<{ nid: number }>(
        `SELECT nid
         FROM bot_proveedores
         WHERE cruc = $1 AND ($2::INT = 0 OR nid <> $2)
         ORDER BY nid
         LIMIT 1`,
        [ruc, providerId],
      )

      if (duplicate.rows[0]?.nid) {
        await client.query('ROLLBACK')
        return reply.code(409).send({
          message: 'Ya existe un proveedor registrado con ese RUC',
        })
      }

      if (providerId > 0) {
        const existing = await client.query<{ nid: number }>(
          `SELECT nid
           FROM bot_proveedores
           WHERE nid = $1
           LIMIT 1`,
          [providerId],
        )

        if (!existing.rows[0]) {
          await client.query('ROLLBACK')
          return reply.code(404).send({
            message: 'Proveedor no encontrado',
          })
        }

        await client.query(
          `UPDATE bot_proveedores
           SET cnombre = $1, cruc = $2, ccontacto = $3, ctelefono = $4, cemail = $5, cdireccion = $6, cnotas = $7, cestado = $8
           WHERE nid = $9`,
          [nombre, ruc, contacto, telefono, email, direccion, notas, estado, providerId],
        )

        await client.query('COMMIT')
        return { ok: true, id: String(providerId) }
      }

      const result = await client.query<{ nid: number }>(
        `INSERT INTO bot_proveedores (cruc, cnombre, ccontacto, ctelefono, cemail, cdireccion, cnotas, cestado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING nid`,
        [ruc, nombre, contacto, telefono, email, direccion, notas, estado],
      )

      await client.query('COMMIT')
      return { ok: true, id: String(result.rows[0]?.nid) }
    } catch (error) {
      await client.query('ROLLBACK')
      if (isUniqueViolation(error)) {
        return reply.code(409).send({
          message: 'Ya existe un proveedor registrado con ese RUC',
        })
      }
      throw error
    } finally {
      client.release()
    }
  })
}
