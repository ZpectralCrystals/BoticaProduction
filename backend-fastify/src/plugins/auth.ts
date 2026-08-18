import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'

export interface AuthUser {
  id: number
  nombre: string
  rol: string
  dni: string
  super: boolean
  admin: boolean
  supervisor: boolean
  username: string
  permisos: string[]
  authSource?: 'local' | 'clerk'
}

export interface AuthTokenPayload extends AuthUser {
  authSource: 'local' | 'clerk'
  clerkUserId?: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AuthTokenPayload
    user: AuthTokenPayload
  }
}

declare module 'fastify' {
  interface PermissionOptions {
    allowAdmin?: boolean
    errorMessage?: string
  }
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    buildAuthUser: (userId: number) => Promise<AuthUser | null>
    resolveAuthUser: (payload: Pick<AuthTokenPayload, 'id' | 'authSource' | 'clerkUserId'>) => Promise<AuthUser | null>
    hasAnyPermission: (user: AuthUser | null, sections: string[], allowAdmin?: boolean) => boolean
    requireAnyPermission: (
      request: FastifyRequest,
      reply: FastifyReply,
      sections: string[],
      options?: PermissionOptions,
    ) => Promise<boolean>
  }
  interface FastifyRequest {
    authUser: AuthUser | null
  }
}

async function loadPermissions(fastify: FastifyInstance, userId: number) {
  const result = await fastify.db.query<{ cseccion: string }>(
    'SELECT cseccion FROM bot_permisos WHERE nusuario_id = $1 ORDER BY cseccion',
    [userId],
  )
  return result.rows.map((row: { cseccion: string }) => row.cseccion.trim())
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.decorate('buildAuthUser', async (userId: number) => {
    const userResult = await fastify.db.query<{
      nid: number
      cnombre: string
      crol: string
      cnrodni: string
      lsuper: boolean
      ladmin: boolean
    }>(
      `SELECT nid, cnombre, crol, cnrodni, lsuper, ladmin
       FROM bot_usuarios
       WHERE nid = $1 AND cestado = 'A'`,
      [userId],
    )

    const row = userResult.rows[0]
    if (!row) return null

    return {
      id: row.nid,
      nombre: row.cnombre.trim(),
      rol: row.crol.trim(),
      dni: row.cnrodni.trim(),
      super: Boolean(row.lsuper),
      admin: Boolean(row.ladmin),
      supervisor: Boolean(row.lsuper),
      username: row.cnombre.trim(),
      permisos: await loadPermissions(fastify, row.nid),
    }
  })

  fastify.decorate('resolveAuthUser', async (payload) => {
    const activeUser = await fastify.buildAuthUser(payload.id)
    if (!activeUser) return null

    const authSource = payload.authSource === 'clerk' ? 'clerk' : 'local'
    if (authSource === 'clerk') {
      if (!payload.clerkUserId) return null

      const linkResult = await fastify.db.query<{ cclerk_user_id: string | null }>(
        `SELECT cclerk_user_id
         FROM bot_usuarios
         WHERE nid = $1 AND cestado = 'A'
         LIMIT 1`,
        [payload.id],
      )
      const currentClerkUserId = linkResult.rows[0]?.cclerk_user_id?.trim() || null
      if (currentClerkUserId !== payload.clerkUserId) return null
    }

    return { ...activeUser, authSource }
  })

  fastify.decorate('requireAuth', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const token =
        request.cookies.botica_token ||
        (request.headers.authorization?.startsWith('Bearer ')
          ? request.headers.authorization.slice(7)
          : undefined)

      if (!token) {
        reply.code(401).send({ error: 'NO HA INICIADO SESION' })
        return
      }

      const payload = await fastify.jwt.verify<AuthTokenPayload>(token)
      const activeUser = await fastify.resolveAuthUser(payload)
      if (!activeUser) {
        reply.code(401).send({ error: 'NO HA INICIADO SESION' })
        return
      }
      request.authUser = activeUser
    } catch {
      reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    }
  })

  fastify.decorate('hasAnyPermission', (user: AuthUser | null, sections: string[], allowAdmin = true) => {
    if (!user) return false
    if (allowAdmin && (user.super || user.admin)) return true
    return sections.some((section) => user.permisos.includes(section))
  })

  fastify.decorate(
    'requireAnyPermission',
    async (
      request: FastifyRequest,
      reply: FastifyReply,
      sections: string[],
      options = {},
    ) => {
      const user = request.authUser
      if (!user) {
        reply.code(401).send({ error: 'NO HA INICIADO SESION' })
        return false
      }

      if (fastify.hasAnyPermission(user, sections, options.allowAdmin ?? true)) {
        return true
      }

      request.log.warn(
        {
          userId: user.id,
          seccionesRequeridas: sections,
          permisosUsuario: user.permisos,
        },
        'Acceso denegado por permisos',
      )

      reply.code(403).send({
        error: 'FORBIDDEN',
        message:
          options.errorMessage ||
          `Permiso insuficiente. Se requiere acceso a: ${sections.join(', ')}`,
      })
      return false
    },
  )

  fastify.addHook('preHandler', async (request) => {
    request.authUser = null
  })

}

export default fp(authPlugin, { name: 'auth', dependencies: ['db'] })
