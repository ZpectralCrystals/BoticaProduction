import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type pg from 'pg'
import authPlugin from '../plugins/auth.js'
import authRoutes from '../routes/auth.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
  TEST_JWT_SECRET,
  TEST_USER,
} from './helpers/buildTestApp.js'

async function buildRealAuthApp(
  mockClient: ReturnType<typeof createMockClient>,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(cookie)
  await app.register(jwt, { secret: TEST_JWT_SECRET })
  await app.register(
    fp(
      async (fastify) => {
        const mockPool = {
          connect: async () => mockClient,
          query: (sql: string, params?: unknown[]) => mockClient.query(sql, params),
          end: async () => {},
        }
        fastify.decorate('db', mockPool as unknown as pg.Pool)
      },
      { name: 'db' },
    ),
  )
  await app.register(authPlugin)
  app.get('/privado', { preHandler: app.requireAuth }, async (request) => ({
    user: request.authUser,
  }))
  await app.ready()
  return app
}

describe('Auth y usuarios inactivos', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>

  afterEach(async () => {
    await app.close()
  })

  describe('login local', () => {
    beforeEach(async () => {
      mockClient = createMockClient()
      app = await buildTestApp(mockClient)
      await app.register(authRoutes, { prefix: '/api/v1/auth' })
      await app.ready()
    })

    it('rechaza login local cuando el usuario no está activo', async () => {
      mockClient.responses.push({ rows: [] })

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { dni: '12345678', clave: '12345678' },
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().error).toBe('CREDENCIALES INVALIDAS')
      expect(mockClient.queries[0].sql).toContain("cestado = 'A'")
    })
  })

  describe('requireAuth', () => {
    beforeEach(async () => {
      mockClient = createMockClient()
      app = await buildRealAuthApp(mockClient)
    })

    it('rechaza tokens existentes si el usuario fue desactivado', async () => {
      mockClient.responses.push({ rows: [] })
      const token = makeTestToken(app, { ...TEST_USER, id: 9 })

      const res = await app.inject({
        method: 'GET',
        url: '/privado',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().error).toBe('NO HA INICIADO SESION')
      expect(mockClient.queries[0].sql).toContain("cestado = 'A'")
      expect(mockClient.queries[0].params).toEqual([9])
    })
  })
})
