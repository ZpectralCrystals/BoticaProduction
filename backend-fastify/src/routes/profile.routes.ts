import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import bcrypt from 'bcryptjs'

export default async function profileRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const result = await fastify.db.query<{
      cnombre: string
      cnrodni: string
      ctelefono: string | null
      cdireccion: string | null
      cemail: string | null
      crol: string
    }>(
      'SELECT cnombre, cnrodni, ctelefono, cdireccion, cemail, crol FROM bot_usuarios WHERE nid = $1',
      [user.id],
    )

    const row = result.rows[0]
    if (!row) return reply.code(404).send({ error: 'USUARIO NO ENCONTRADO' })

    return {
      nombre: row.cnombre.trim(),
      dni: row.cnrodni.trim(),
      telefono: String(row.ctelefono || '').trim(),
      direccion: String(row.cdireccion || '').trim(),
      email: String(row.cemail || '').trim(),
      rol: row.crol.trim(),
    }
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = request.authUser
    if (!user) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    const body = request.body as {
      action?: string
      telefono?: string
      direccion?: string
      email?: string
      nombre?: string
      claveActual?: string
      claveNueva?: string
    }

    const action = String(body.action || 'actualizar')

    if (action === 'actualizar') {
      const sets: string[] = []
      const values: string[] = []

      if (body.telefono !== undefined) {
        values.push(String(body.telefono).trim())
        sets.push(`ctelefono = $${values.length}`)
      }
      if (body.direccion !== undefined) {
        values.push(String(body.direccion).trim())
        sets.push(`cdireccion = $${values.length}`)
      }
      if (body.email !== undefined) {
        values.push(String(body.email).trim())
        sets.push(`cemail = $${values.length}`)
      }
      if (body.nombre !== undefined) {
        values.push(String(body.nombre).trim())
        sets.push(`cnombre = $${values.length}`)
      }

      if (!sets.length) return reply.code(400).send({ error: 'NADA QUE ACTUALIZAR' })

      sets.push('tmodifi = NOW()')
      values.push(String(user.id))

      await fastify.db.query(
        `UPDATE bot_usuarios SET ${sets.join(', ')} WHERE nid = $${values.length}`,
        values,
      )

      return { ok: true, message: 'Perfil actualizado' }
    }

    if (action === 'cambiarClave') {
      const claveActual = String(body.claveActual || '')
      const claveNueva = String(body.claveNueva || '')

      if (!claveActual || !claveNueva) {
        return reply.code(400).send({ error: 'CLAVE ACTUAL Y NUEVA SON OBLIGATORIAS' })
      }
      if (claveNueva.length < 6) {
        return reply.code(400).send({ error: 'LA NUEVA CLAVE DEBE TENER AL MENOS 6 CARACTERES' })
      }

      const result = await fastify.db.query<{ cclave: string }>(
        'SELECT cclave FROM bot_usuarios WHERE nid = $1',
        [user.id],
      )
      const row = result.rows[0]
      const valid = row ? await bcrypt.compare(claveActual, row.cclave.trim()) : false
      if (!valid) {
        return reply.code(400).send({ error: 'LA CLAVE ACTUAL ES INCORRECTA' })
      }

      const hash = await bcrypt.hash(claveNueva, 12)
      await fastify.db.query(
        'UPDATE bot_usuarios SET cclave = $1, tmodifi = NOW() WHERE nid = $2',
        [hash, user.id],
      )
      await fastify.db.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'CAMBIAR_CLAVE', 'bot_usuarios', $3, 'Usuario cambio su clave')`,
        [user.id, user.nombre, user.id],
      )

      return { ok: true, message: 'Clave actualizada correctamente' }
    }

    return reply.code(400).send({ error: 'ACCION NO VALIDA' })
  })
}
