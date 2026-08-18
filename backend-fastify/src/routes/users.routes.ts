import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify'
import bcrypt from 'bcryptjs'
import { createClerkClient } from '@clerk/backend'

type UserListRow = {
  nid: number
  cnrodni: string
  cnombre: string
  crol: string
  cestado: string
  lsuper: boolean
  ladmin: boolean
  cclerk_user_id: string | null
  tcreado: string
}

type ClerkLinkStatusRow = {
  nid: number
  cnombre: string
  cnrodni: string
  cestado: string
  cclerk_user_id: string | null
}

type ClerkEmailAddress = {
  id: string
  emailAddress: string
}

export type ClerkEmailAdminClient = {
  users: {
    getUser: (userId: string) => Promise<{
      banned: boolean
      emailAddresses: ClerkEmailAddress[]
      primaryEmailAddress?: ClerkEmailAddress | null
    }>
  }
  emailAddresses: {
    createEmailAddress: (params: {
      userId: string
      emailAddress: string
      verified: boolean
      primary: boolean
    }) => Promise<ClerkEmailAddress>
    updateEmailAddress: (
      emailAddressId: string,
      params: { verified: boolean; primary: boolean },
    ) => Promise<ClerkEmailAddress>
    deleteEmailAddress: (emailAddressId: string) => Promise<unknown>
  }
}

async function hasClerkUserIdColumn(fastify: FastifyInstance) {
  const result = await fastify.db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'bot_usuarios'
         AND column_name = 'cclerk_user_id'
     )`,
  )
  return Boolean(result.rows[0]?.exists)
}

function canManageUsers(request: FastifyRequest) {
  const user = request.authUser
  return Boolean(user && (user.super || user.admin))
}

function normalizeClerkUserId(value: unknown) {
  return String(value ?? '').trim()
}

function isValidClerkUserId(value: string) {
  return value.startsWith('user_') && value.length > 5 && value.length <= 255
}

export function normalizeClerkEmail(value: unknown) {
  return String(value ?? '').trim().toLowerCase()
}

export function isValidClerkEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function replaceClerkUserEmail(
  clerkClient: ClerkEmailAdminClient,
  clerkUserId: string,
  email: string,
) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId)
  if (clerkUser.banned) {
    const error = new Error('No se puede editar el correo de un usuario Clerk bloqueado')
    Object.assign(error, { statusCode: 400 })
    throw error
  }

  const existingEmail = clerkUser.emailAddresses.find(
    (item) => item.emailAddress.trim().toLowerCase() === email,
  )
  const targetEmail = existingEmail
    ? await clerkClient.emailAddresses.updateEmailAddress(existingEmail.id, {
        verified: true,
        primary: true,
      })
    : await clerkClient.emailAddresses.createEmailAddress({
        userId: clerkUserId,
        emailAddress: email,
        verified: true,
        primary: true,
      })

  const removedEmails: string[] = []
  for (const currentEmail of clerkUser.emailAddresses) {
    if (currentEmail.id === targetEmail.id) continue
    await clerkClient.emailAddresses.deleteEmailAddress(currentEmail.id)
    removedEmails.push(currentEmail.emailAddress)
  }

  return {
    email: targetEmail.emailAddress.trim().toLowerCase(),
    removedEmails,
  }
}

function buildClerkLinkResponse(row: ClerkLinkStatusRow, clerkEmail: string | null = null) {
  const clerkUserId = row.cclerk_user_id?.trim() || null
  return {
    userId: String(row.nid),
    nombre: row.cnombre.trim(),
    dni: row.cnrodni.trim(),
    estado: row.cestado.trim(),
    clerkLinked: Boolean(clerkUserId),
    clerkUserId,
    clerkEmail,
  }
}

function clerkClientFromEnv() {
  const secretKey = String(process.env.CLERK_SECRET_KEY || '').trim()
  return secretKey ? createClerkClient({ secretKey }) : null
}

async function getUserClerkStatus(
  fastify: FastifyInstance,
  userId: number,
) {
  const result = await getUserClerkStatusWithSchema(fastify, userId)
  return result.targetUser
}

async function getUserClerkStatusWithSchema(
  fastify: FastifyInstance,
  userId: number,
) {
  const hasClerkColumn = await hasClerkUserIdColumn(fastify)
  const clerkSelect = hasClerkColumn ? 'cclerk_user_id' : 'NULL::TEXT AS cclerk_user_id'
  const result = await fastify.db.query<ClerkLinkStatusRow>(
    `SELECT nid, cnombre, cnrodni, cestado, ${clerkSelect}
     FROM bot_usuarios
     WHERE nid = $1
     LIMIT 1`,
    [userId],
  )
  return { targetUser: result.rows[0] ?? null, hasClerkColumn }
}

function ensureUsersPermission(request: FastifyRequest, reply: FastifyReply) {
  const user = request.authUser
  if (!user) {
    reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    return null
  }
  if (!canManageUsers(request)) {
    reply.code(403).send({ error: 'NO TIENE PERMISOS PARA GESTIONAR USUARIOS' })
    return null
  }
  return user
}

export default async function usersRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const user = ensureUsersPermission(request, reply)
    if (!user) return

    const hasClerkColumn = await hasClerkUserIdColumn(fastify)
    const clerkSelect = hasClerkColumn ? 'cclerk_user_id' : 'NULL::TEXT AS cclerk_user_id'
    const usersResult = await fastify.db.query<UserListRow>(
      `SELECT nid, cnrodni, cnombre, crol, cestado, lsuper, ladmin, ${clerkSelect}, tcreado::TEXT
       FROM bot_usuarios
       ORDER BY nid`,
    )

    const usuarios = []
    for (const row of usersResult.rows) {
      const permissionsResult = await fastify.db.query<{ cseccion: string }>(
        'SELECT cseccion FROM bot_permisos WHERE nusuario_id = $1 ORDER BY cseccion',
        [row.nid],
      )
      usuarios.push({
        id: String(row.nid),
        dni: row.cnrodni.trim(),
        nombre: row.cnombre.trim(),
        rol: row.crol.trim(),
        estado: row.cestado.trim(),
        super: Boolean(row.lsuper),
        admin: Boolean(row.ladmin),
        clerkLinked: Boolean(row.cclerk_user_id?.trim()),
        clerkUserId: row.cclerk_user_id?.trim() || null,
        permisos: permissionsResult.rows.map((permission) => permission.cseccion.trim()),
        creado: row.tcreado,
      })
    }

    return usuarios
  })

  fastify.get('/clerk/search', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = ensureUsersPermission(request, reply)
    if (!actor) return

    const query = String((request.query as { q?: string })?.q || '').trim()
    if (query.length < 2) {
      return reply.code(400).send({ message: 'Ingrese al menos 2 caracteres para buscar en Clerk' })
    }

    const clerkClient = clerkClientFromEnv()
    if (!clerkClient) {
      return reply.code(503).send({
        message: 'Búsqueda Clerk no configurada: falta CLERK_SECRET_KEY',
      })
    }

    try {
      const result = await clerkClient.users.getUserList({ query, limit: 10 })
      return result.data.map((user) => ({
        id: user.id,
        nombre: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Usuario Clerk',
        email: user.primaryEmailAddress?.emailAddress || null,
        avatarUrl: user.imageUrl || null,
        banned: Boolean(user.banned),
      }))
    } catch (error) {
      request.log.error({ error }, 'No se pudo consultar usuarios Clerk')
      return reply.code(502).send({ message: 'No se pudo consultar usuarios en Clerk' })
    }
  })

  fastify.get('/:id/clerk-link', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = ensureUsersPermission(request, reply)
    if (!actor) return

    const params = request.params as { id?: string }
    const userId = Number(params.id || 0)
    if (!userId) {
      return reply.code(400).send({ message: 'El ID del usuario es obligatorio' })
    }

    const targetUser = await getUserClerkStatus(fastify, userId)
    if (!targetUser) {
      return reply.code(404).send({ message: 'Usuario no encontrado' })
    }

    const clerkUserId = targetUser.cclerk_user_id?.trim() || null
    const clerkClient = clerkClientFromEnv()
    let clerkEmail: string | null = null
    if (clerkUserId && clerkClient) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId)
        clerkEmail = clerkUser.primaryEmailAddress?.emailAddress?.trim().toLowerCase() || null
      } catch (error) {
        request.log.warn({ error, clerkUserId }, 'No se pudo consultar el correo primario Clerk')
      }
    }

    return buildClerkLinkResponse(targetUser, clerkEmail)
  })

  fastify.put('/:id/clerk-email', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = ensureUsersPermission(request, reply)
    if (!actor) return

    const params = request.params as { id?: string }
    const body = request.body as { email?: string }
    const userId = Number(params.id || 0)
    const email = normalizeClerkEmail(body?.email)

    if (!userId) {
      return reply.code(400).send({ message: 'El ID del usuario es obligatorio' })
    }
    if (!email) {
      return reply.code(400).send({ message: 'El correo Clerk es obligatorio' })
    }
    if (!isValidClerkEmail(email)) {
      return reply.code(400).send({ message: 'Ingrese un correo Clerk válido' })
    }

    const { targetUser, hasClerkColumn } = await getUserClerkStatusWithSchema(fastify, userId)
    if (!targetUser) {
      return reply.code(404).send({ message: 'Usuario no encontrado' })
    }
    if (!hasClerkColumn) {
      return reply.code(503).send({ message: 'Vinculación Clerk no configurada: falta columna bot_usuarios.cclerk_user_id' })
    }

    const clerkUserId = targetUser.cclerk_user_id?.trim() || null
    if (!clerkUserId) {
      return reply.code(400).send({ message: 'Primero debe vincular el usuario ERP con Clerk' })
    }

    const clerkClient = clerkClientFromEnv()
    if (!clerkClient) {
      return reply.code(503).send({ message: 'Edición Clerk no configurada: falta CLERK_SECRET_KEY' })
    }

    try {
      const result = await replaceClerkUserEmail(
        clerkClient as unknown as ClerkEmailAdminClient,
        clerkUserId,
        email,
      )

      await fastify.db.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'ACTUALIZAR_CORREO_CLERK', 'bot_usuarios', $3, $4)`,
        [
          actor.id,
          actor.nombre,
          userId,
          `Correo Clerk actualizado a ${result.email}; correos retirados: ${result.removedEmails.join(', ') || 'ninguno'}`,
        ],
      )

      request.log.info(
        { actorId: actor.id, targetUserId: userId, clerkUserId, email: result.email },
        'Correo de acceso Clerk actualizado',
      )

      return {
        ok: true,
        message: 'Correo de acceso Clerk actualizado correctamente',
        ...buildClerkLinkResponse(targetUser, result.email),
      }
    } catch (error: any) {
      request.log.error({ error, clerkUserId, email }, 'No se pudo actualizar el correo Clerk')
      const status = Number(error?.status || error?.statusCode || 0)
      return reply.code(status >= 400 && status < 500 ? status : 502).send({
        message: error?.message || 'No se pudo actualizar el correo en Clerk',
      })
    }
  })

  fastify.post('/:id/clerk-link', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = ensureUsersPermission(request, reply)
    if (!actor) return

    const params = request.params as { id?: string }
    const body = request.body as { clerkUserId?: string }
    const userId = Number(params.id || 0)
    const clerkUserId = normalizeClerkUserId(body?.clerkUserId)

    if (!userId) {
      return reply.code(400).send({ message: 'El ID del usuario es obligatorio' })
    }
    if (!clerkUserId) {
      return reply.code(400).send({ message: 'clerkUserId es obligatorio' })
    }
    if (!isValidClerkUserId(clerkUserId)) {
      return reply.code(400).send({ message: 'El Clerk User ID debe iniciar con "user_" y ser válido' })
    }

    const clerkClient = clerkClientFromEnv()
    if (clerkClient) {
      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId)
        if (clerkUser.banned) {
          return reply.code(400).send({ message: 'No se puede vincular un usuario Clerk bloqueado' })
        }
      } catch (error: any) {
        request.log.warn({ error, clerkUserId }, 'Clerk User ID no pudo validarse')
        const status = Number(error?.status || error?.statusCode || 0)
        return reply.code(status === 404 ? 404 : 502).send({
          message: status === 404
            ? 'El usuario no existe en Clerk'
            : 'No se pudo validar el usuario en Clerk',
        })
      }
    }

    const { targetUser, hasClerkColumn } = await getUserClerkStatusWithSchema(fastify, userId)
    if (!targetUser) {
      return reply.code(404).send({ message: 'Usuario no encontrado' })
    }
    if (!hasClerkColumn) {
      return reply.code(503).send({ message: 'Vinculación Clerk no configurada: falta columna bot_usuarios.cclerk_user_id' })
    }
    if (targetUser.cestado.trim() !== 'A') {
      return reply.code(400).send({ message: 'Solo se puede vincular Clerk a usuarios ERP activos' })
    }
    if ((targetUser.cclerk_user_id?.trim() || '') === clerkUserId) {
      return {
        ok: true,
        alreadyLinked: true,
        message: 'El usuario ERP ya estaba vinculado a ese Clerk User ID',
        ...buildClerkLinkResponse(targetUser),
      }
    }

    const duplicateResult = await fastify.db.query<{ nid: number; cnombre: string }>(
      `SELECT nid, cnombre
       FROM bot_usuarios
       WHERE cclerk_user_id = $1
         AND nid <> $2
       LIMIT 1`,
      [clerkUserId, userId],
    )
    const duplicate = duplicateResult.rows[0]
    if (duplicate) {
      return reply.code(409).send({
        message: `Ese Clerk User ID ya está vinculado al usuario ERP ${duplicate.cnombre.trim()} (#${duplicate.nid})`,
      })
    }

    try {
      await fastify.db.query(
        `UPDATE bot_usuarios
         SET cclerk_user_id = $1,
             tmodifi = NOW()
         WHERE nid = $2`,
        [clerkUserId, userId],
      )
    } catch (error: any) {
      if (error?.code === '23505') {
        return reply.code(409).send({
          message: 'Ese Clerk User ID ya está vinculado a otro usuario ERP',
        })
      }
      throw error
    }

    await fastify.db.query(
      `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
       VALUES ($1, $2, 'VINCULAR_CLERK', 'bot_usuarios', $3, $4)`,
      [
        actor.id,
        actor.nombre,
        userId,
        `Vinculo Clerk ${clerkUserId} asignado al usuario ERP #${userId}`,
      ],
    )

    fastify.log.info(
      { actorId: actor.id, targetUserId: userId, clerkUserId },
      'Usuario ERP vinculado con Clerk',
    )

    return {
      ok: true,
      message: 'Usuario ERP vinculado con Clerk',
      ...buildClerkLinkResponse({ ...targetUser, cclerk_user_id: clerkUserId }),
    }
  })

  fastify.delete('/:id/clerk-link', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = ensureUsersPermission(request, reply)
    if (!actor) return

    const params = request.params as { id?: string }
    const userId = Number(params.id || 0)
    if (!userId) {
      return reply.code(400).send({ message: 'El ID del usuario es obligatorio' })
    }

    const { targetUser, hasClerkColumn } = await getUserClerkStatusWithSchema(fastify, userId)
    if (!targetUser) {
      return reply.code(404).send({ message: 'Usuario no encontrado' })
    }

    const currentClerkUserId = targetUser.cclerk_user_id?.trim() || null
    if (!hasClerkColumn) {
      return reply.code(503).send({ message: 'Vinculación Clerk no configurada: falta columna bot_usuarios.cclerk_user_id' })
    }
    if (!currentClerkUserId) {
      return {
        ok: true,
        alreadyUnlinked: true,
        message: 'El usuario ERP ya estaba desvinculado de Clerk',
        ...buildClerkLinkResponse(targetUser),
      }
    }

    await fastify.db.query(
      `UPDATE bot_usuarios
       SET cclerk_user_id = NULL,
           tmodifi = NOW()
       WHERE nid = $1`,
      [userId],
    )

    await fastify.db.query(
      `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
       VALUES ($1, $2, 'DESVINCULAR_CLERK', 'bot_usuarios', $3, $4)`,
      [
        actor.id,
        actor.nombre,
        userId,
        `Vinculo Clerk ${currentClerkUserId} removido del usuario ERP #${userId}`,
      ],
    )

    fastify.log.info(
      { actorId: actor.id, targetUserId: userId, clerkUserId: currentClerkUserId },
      'Usuario ERP desvinculado de Clerk',
    )

    return {
      ok: true,
      message: 'Vínculo Clerk removido correctamente',
      ...buildClerkLinkResponse({ ...targetUser, cclerk_user_id: null }),
    }
  })

  fastify.post('/', { preHandler: fastify.requireAuth }, async (request, reply) => {
    const actor = ensureUsersPermission(request, reply)
    if (!actor) return

    const body = request.body as {
      action?: string
      id?: number
      dni?: string
      nombre?: string
      rol?: string
      permisos?: string[]
      admin?: boolean
    }
    const action = String(body.action || 'crear')

    if (action === 'crear') {
      const dni = String(body.dni || '').trim()
      const nombre = String(body.nombre || '').trim()
      const rol = String(body.rol || 'caja').trim() || 'caja'
      const permisos = Array.isArray(body.permisos) ? body.permisos : []

      if (!/^\d{8}$/.test(dni)) return reply.code(400).send({ error: 'DNI INVALIDO (8 digitos)' })
      if (!nombre) return reply.code(400).send({ error: 'NOMBRE ES OBLIGATORIO' })

      const existingResult = await fastify.db.query<{ nid: number; cestado: string }>(
        'SELECT nid, cestado FROM bot_usuarios WHERE cnrodni = $1',
        [dni],
      )
      const existing = existingResult.rows[0]
      const passwordHash = await bcrypt.hash(dni, 12)

      if (existing) {
        if (existing.cestado.trim() === 'I') {
          await fastify.db.query(
            `UPDATE bot_usuarios
             SET cnombre = $1, crol = $2, cclave = $3, cestado = 'A', tmodifi = NOW()
             WHERE nid = $4`,
            [nombre, rol, passwordHash, existing.nid],
          )
          await fastify.db.query('DELETE FROM bot_permisos WHERE nusuario_id = $1', [existing.nid])
          for (const permiso of permisos) {
            await fastify.db.query(
              'INSERT INTO bot_permisos (nusuario_id, cseccion) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [existing.nid, permiso],
            )
          }
          return { ok: true, id: String(existing.nid), reactivado: true }
        }
        return reply.code(400).send({ error: 'USUARIO CON ESE DNI YA EXISTE' })
      }

      const result = await fastify.db.query<{ nid: number }>(
        `INSERT INTO bot_usuarios (cnrodni, cnombre, cclave, crol)
         VALUES ($1, $2, $3, $4)
         RETURNING nid`,
        [dni, nombre, passwordHash, rol],
      )
      const userId = result.rows[0]?.nid

      for (const permiso of permisos) {
        await fastify.db.query(
          'INSERT INTO bot_permisos (nusuario_id, cseccion) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, permiso],
        )
      }

      await fastify.db.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'CREAR_USUARIO', 'bot_usuarios', $3, $4)`,
        [actor.id, actor.nombre, userId, `Crear usuario ${nombre} DNI ${dni}`],
      )

      return { ok: true, id: String(userId) }
    }

    if (action === 'actualizar') {
      const id = Number(body.id || 0)
      if (!id) return reply.code(400).send({ error: 'ID ES OBLIGATORIO' })
      if (body.admin && !actor.super) {
        return reply.code(400).send({ error: 'SOLO EL SUPER USUARIO PUEDE OTORGAR PODERES DE ADMIN' })
      }

      const sets: string[] = []
      const values: Array<string | boolean | number> = []

      if (body.nombre) {
        values.push(String(body.nombre).trim())
        sets.push(`cnombre = $${values.length}`)
      }
      if (body.rol) {
        values.push(String(body.rol).trim())
        sets.push(`crol = $${values.length}`)
      }
      if (body.admin !== undefined && actor.super) {
        values.push(Boolean(body.admin))
        sets.push(`ladmin = $${values.length}`)
      }
      sets.push('tmodifi = NOW()')
      values.push(id)

      await fastify.db.query(
        `UPDATE bot_usuarios SET ${sets.join(', ')} WHERE nid = $${values.length}`,
        values,
      )

      if (body.permisos) {
        await fastify.db.query('DELETE FROM bot_permisos WHERE nusuario_id = $1', [id])
        for (const permiso of body.permisos) {
          await fastify.db.query(
            'INSERT INTO bot_permisos (nusuario_id, cseccion) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, permiso],
          )
        }
      }

      await fastify.db.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'ACTUALIZAR_USUARIO', 'bot_usuarios', $3, $4)`,
        [actor.id, actor.nombre, id, `Actualizar usuario #${id}`],
      )

      return { ok: true, id: String(id) }
    }

    if (action === 'desactivar' || action === 'activar') {
      const id = Number(body.id || 0)
      if (!id) return reply.code(400).send({ error: 'ID ES OBLIGATORIO' })

      const result = await fastify.db.query<{ lsuper: boolean }>(
        'SELECT lsuper FROM bot_usuarios WHERE nid = $1',
        [id],
      )
      if (result.rows[0]?.lsuper && action === 'desactivar') {
        return reply.code(400).send({ error: 'NO SE PUEDE DESACTIVAR AL SUPER USUARIO' })
      }

      const estado = action === 'desactivar' ? 'I' : 'A'
      await fastify.db.query(
        "UPDATE bot_usuarios SET cestado = $1, tmodifi = NOW() WHERE nid = $2",
        [estado, id],
      )
      await fastify.db.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, $3, 'bot_usuarios', $4, $5)`,
        [actor.id, actor.nombre, `${action.toUpperCase()}_USUARIO`, id, `${action[0].toUpperCase()}${action.slice(1)} usuario #${id}`],
      )
      return { ok: true }
    }

    if (action === 'resetClave') {
      const id = Number(body.id || 0)
      if (!id) return reply.code(400).send({ error: 'ID ES OBLIGATORIO' })

      const result = await fastify.db.query<{ cnrodni: string }>(
        'SELECT cnrodni FROM bot_usuarios WHERE nid = $1',
        [id],
      )
      const row = result.rows[0]
      if (!row) return reply.code(404).send({ error: 'USUARIO NO ENCONTRADO' })

      const passwordHash = await bcrypt.hash(row.cnrodni.trim(), 12)
      await fastify.db.query(
        'UPDATE bot_usuarios SET cclave = $1, tmodifi = NOW() WHERE nid = $2',
        [passwordHash, id],
      )

      return { ok: true, message: 'Clave reseteada al DNI' }
    }

    return reply.code(400).send({ error: 'ACCION NO VALIDA' })
  })
}
