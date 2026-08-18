import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import bcrypt from 'bcryptjs'
import { verifyToken } from '@clerk/backend'
import type { AuthTokenPayload } from '../plugins/auth.js'

function envList(value: string | undefined) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

async function verifyClerkToken(token: string) {
  const secretKey = String(process.env.CLERK_SECRET_KEY || '').trim()
  const jwtKey = String(process.env.CLERK_JWT_KEY || '').trim()
  const expectedIssuer = String(process.env.CLERK_JWT_ISSUER || '').trim()
  const authorizedParties = envList(
    process.env.CLERK_AUTHORIZED_PARTIES || process.env.CORS_ORIGIN,
  )

  if (!secretKey && !jwtKey) {
    throw new Error('CLERK_KEYS_NOT_CONFIGURED')
  }

  const payload = await verifyToken(token, {
    ...(secretKey ? { secretKey } : {}),
    ...(jwtKey ? { jwtKey } : {}),
    ...(authorizedParties.length > 0 ? { authorizedParties } : {}),
  })

  if (!payload.sub) {
    throw new Error('CLERK_TOKEN_MISSING_SUB')
  }
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    throw new Error('CLERK_TOKEN_INVALID_ISSUER')
  }

  return {
    clerkUserId: payload.sub,
  }
}

export default async function authRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.post('/clerk-sync', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '15 minutes',
      },
    },
  }, async (request, reply) => {
    const authHeader = String(request.headers.authorization || '')
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

    if (!bearerToken) {
      return reply.code(400).send({
        error: 'CLERK_TOKEN_REQUIRED',
        message: 'Se requiere token de Clerk en Authorization: Bearer <token>.',
      })
    }

    let clerkUserId = ''
    try {
      const verified = await verifyClerkToken(bearerToken)
      clerkUserId = verified.clerkUserId
    } catch (error) {
      request.log.warn({ error }, 'Token de Clerk inválido')
      return reply.code(401).send({
        error: 'CLERK_TOKEN_INVALID',
        message: 'No se pudo verificar la identidad de Clerk.',
      })
    }

    const linkedResult = await fastify.db.query<{ nid: number }>(
      `SELECT nid
       FROM bot_usuarios
       WHERE cclerk_user_id = $1
         AND cestado = 'A'
       LIMIT 1`,
      [clerkUserId],
    )

    const linkedRow = linkedResult.rows[0]
    if (!linkedRow) {
      return reply.code(403).send({
        error: 'CLERK_NOT_LINKED',
        message: 'El usuario Clerk no está vinculado a un usuario ERP activo.',
        clerkUserId,
      })
    }

    const user = await fastify.buildAuthUser(linkedRow.nid)
    if (!user) {
      return reply.code(401).send({
        error: 'ERP_USER_NOT_AVAILABLE',
        message: 'El usuario ERP vinculado no está disponible.',
      })
    }

    const tokenPayload: AuthTokenPayload = {
      ...user,
      authSource: 'clerk',
      clerkUserId,
    }
    const token = await reply.jwtSign(tokenPayload)

    fastify.db.query(
      `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
       VALUES ($1, $2, 'LOGIN_CLERK', 'bot_usuarios', $1, $3)`,
      [user.id, user.nombre, `Login Clerk exitoso desde ${request.ip}`],
    ).catch(() => {})

    reply.setCookie('botica_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
    })

    return {
      linked: true,
      authSource: 'clerk',
      user: { ...user, authSource: 'clerk' },
      token,
    }
  })

  fastify.get('/session', async (request, reply) => {
    const token =
      request.cookies.botica_token ||
      (request.headers.authorization?.startsWith('Bearer ')
        ? request.headers.authorization.slice(7)
        : undefined)
    if (!token) return reply.code(401).send({ error: 'NO HA INICIADO SESION' })

    try {
      const payload = await fastify.jwt.verify<AuthTokenPayload>(token)
      const user = await fastify.resolveAuthUser(payload)
      if (!user) {
        return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
      }
      return user
    } catch {
      return reply.code(401).send({ error: 'NO HA INICIADO SESION' })
    }
  })

  fastify.post('/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
        errorResponseBuilder: (_request: unknown, context: { after: string }) => ({
          error: 'TOO_MANY_REQUESTS',
          message: `Demasiados intentos de inicio de sesión. Intente de nuevo en ${context.after}.`,
        }),
      },
    },
  }, async (request, reply) => {
    const body = request.body as { dni?: string; clave?: string }
    const dni = String(body?.dni || '').trim()
    const clave = String(body?.clave || '')

    if (!/^\d{8}$/.test(dni)) {
      return reply.code(400).send({ error: 'NUMERO DE DNI INVALIDO' })
    }
    if (!clave) {
      return reply.code(400).send({ error: 'CONTRASEÑA INVALIDA' })
    }

    const userResult = await fastify.db.query<{
      nid: number
      cnombre: string
      cclave: string
      crol: string
      cnrodni: string
      lsuper: boolean
      ladmin: boolean
    }>(
      `SELECT nid, cnombre, cclave, crol, cnrodni, lsuper, ladmin
       FROM bot_usuarios
       WHERE cnrodni = $1 AND cestado = 'A'`,
      [dni],
    )

    const row = userResult.rows[0]
    if (!row) {
      return reply.code(401).send({ error: 'CREDENCIALES INVALIDAS' })
    }

    const isValid = await bcrypt.compare(clave, row.cclave.trim())
    if (!isValid) {
      // Fire-and-forget: no bloquea la respuesta si la DB falla
      fastify.db.query(
        `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
         VALUES ($1, $2, 'LOGIN_FALLIDO', 'bot_usuarios', $1, $3)`,
        [row.nid, row.cnombre.trim(), `Contraseña incorrecta desde ${request.ip}`],
      ).catch(() => {})
      return reply.code(401).send({ error: 'CREDENCIALES INVALIDAS' })
    }

    const user = await fastify.buildAuthUser(row.nid)
    if (!user) {
      return reply.code(401).send({ error: 'USUARIO NO DISPONIBLE' })
    }

    const tokenPayload: AuthTokenPayload = { ...user, authSource: 'local' }
    const token = await reply.jwtSign(tokenPayload)

    // Fire-and-forget: audit de login exitoso
    fastify.db.query(
      `INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
       VALUES ($1, $2, 'LOGIN', 'bot_usuarios', $1, $3)`,
      [user.id, user.nombre, `Login exitoso desde ${request.ip}`],
    ).catch(() => {})

    reply.setCookie('botica_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
    })

    return { ...user, authSource: 'local', token }
  })

  fastify.post('/logout', async (_request, reply) => {
    reply.clearCookie('botica_token', { path: '/' })
    return { ok: true }
  })
}
