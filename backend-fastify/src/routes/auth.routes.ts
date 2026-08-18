import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import bcrypt from 'bcryptjs'
import { createPublicKey, verify as verifySignature } from 'node:crypto'

type JwtHeader = {
  alg?: string
  kid?: string
}

type JwtPayload = {
  sub?: string
  iss?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64')
}

function decodeJwtPart<T>(value: string): T {
  const raw = decodeBase64Url(value).toString('utf8')
  return JSON.parse(raw) as T
}

async function verifyClerkToken(token: string) {
  const jwksUrl = String(process.env.CLERK_JWKS_URL || '').trim()
  const expectedIssuer = String(process.env.CLERK_JWT_ISSUER || '').trim()

  if (!jwksUrl) {
    throw new Error('CLERK_JWKS_URL_NOT_CONFIGURED')
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('CLERK_TOKEN_INVALID_FORMAT')
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = decodeJwtPart<JwtHeader>(encodedHeader)
  const payload = decodeJwtPart<JwtPayload>(encodedPayload)

  if (header.alg !== 'RS256') {
    throw new Error('CLERK_TOKEN_UNSUPPORTED_ALG')
  }
  if (!header.kid) {
    throw new Error('CLERK_TOKEN_MISSING_KID')
  }
  if (!payload.sub) {
    throw new Error('CLERK_TOKEN_MISSING_SUB')
  }

  const now = Math.floor(Date.now() / 1000)
  if (typeof payload.exp === 'number' && payload.exp <= now) {
    throw new Error('CLERK_TOKEN_EXPIRED')
  }
  if (typeof payload.nbf === 'number' && payload.nbf > now) {
    throw new Error('CLERK_TOKEN_NOT_YET_VALID')
  }
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    throw new Error('CLERK_TOKEN_INVALID_ISSUER')
  }

  const jwksResponse = await fetch(jwksUrl)
  if (!jwksResponse.ok) {
    throw new Error('CLERK_JWKS_FETCH_FAILED')
  }

  const jwks = await jwksResponse.json() as {
    keys?: Array<Record<string, unknown> & { kid?: string }>
  }
  const matchingJwk = jwks.keys?.find((key) => key.kid === header.kid)
  if (!matchingJwk) {
    throw new Error('CLERK_JWK_NOT_FOUND')
  }

  const publicKey = createPublicKey({ key: matchingJwk as any, format: 'jwk' })
  const signedContent = Buffer.from(`${encodedHeader}.${encodedPayload}`)
  const signature = decodeBase64Url(encodedSignature)

  const signatureOk = verifySignature('RSA-SHA256', signedContent, publicKey, signature)
  if (!signatureOk) {
    throw new Error('CLERK_TOKEN_INVALID_SIGNATURE')
  }

  return {
    clerkUserId: payload.sub,
  }
}

export default async function authRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.post('/clerk-sync', async (request, reply) => {
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

    const token = await reply.jwtSign(user)

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
      user,
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
      const payload = await fastify.jwt.verify<{ id: number }>(token)
      const user = await fastify.buildAuthUser(payload.id)
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

    const token = await reply.jwtSign(user)

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

    return { ...user, token }
  })

  fastify.post('/logout', async (_request, reply) => {
    reply.clearCookie('botica_token', { path: '/' })
    return { ok: true }
  })
}
