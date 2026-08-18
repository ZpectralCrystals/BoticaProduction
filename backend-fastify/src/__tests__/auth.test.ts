import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

const { verifyTokenMock } = vi.hoisted(() => ({
  verifyTokenMock: vi.fn(),
}))

vi.mock('@clerk/backend', () => ({
  verifyToken: verifyTokenMock,
}))

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
    delete process.env.CLERK_SECRET_KEY
    verifyTokenMock.mockReset()
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

  describe('login Clerk', () => {
    beforeEach(async () => {
      process.env.CLERK_SECRET_KEY = 'sk_test_unit'
      mockClient = createMockClient()
      app = await buildTestApp(mockClient)
      await app.register(authRoutes, { prefix: '/api/v1/auth' })
      await app.ready()
    })

    it('crea sesión ERP para un usuario Clerk vinculado', async () => {
      verifyTokenMock.mockResolvedValue({
        sub: 'user_clerk_123',
        iss: 'https://test.clerk.accounts.dev',
      })
      mockClient.responses.push({ rows: [{ nid: 1 }] })

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/clerk-sync',
        headers: { authorization: 'Bearer clerk-session-token' },
      })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual(expect.objectContaining({
        linked: true,
        authSource: 'clerk',
        user: expect.objectContaining({ id: 1, authSource: 'clerk' }),
      }))
      const payload = app.jwt.verify(res.json().token)
      expect(payload).toEqual(expect.objectContaining({
        authSource: 'clerk',
        clerkUserId: 'user_clerk_123',
      }))
    })

    it('rechaza tokens Clerk inválidos', async () => {
      verifyTokenMock.mockRejectedValue(new Error('invalid token'))

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/clerk-sync',
        headers: { authorization: 'Bearer invalid-token' },
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().error).toBe('CLERK_TOKEN_INVALID')
    })

    it('niega Clerk válido sin vínculo ERP', async () => {
      verifyTokenMock.mockResolvedValue({ sub: 'user_without_link' })
      mockClient.responses.push({ rows: [] })

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/clerk-sync',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(res.statusCode).toBe(403)
      expect(res.json().error).toBe('CLERK_NOT_LINKED')
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

    it('revoca una sesión Clerk cuando se elimina su vínculo ERP', async () => {
      mockClient.responses.push(
        {
          rows: [{
            nid: 9,
            cnombre: 'Usuario Clerk',
            crol: 'caja',
            cnrodni: '87654321',
            lsuper: false,
            ladmin: false,
          }],
        },
        { rows: [{ cseccion: 'ventas' }] },
        { rows: [{ cclerk_user_id: null }] },
      )
      const token = app.jwt.sign({
        ...TEST_USER,
        id: 9,
        authSource: 'clerk',
        clerkUserId: 'user_clerk_123',
      })

      const res = await app.inject({
        method: 'GET',
        url: '/privado',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.statusCode).toBe(401)
      expect(res.json().error).toBe('NO HA INICIADO SESION')
      expect(mockClient.queries[2].sql).toContain('cclerk_user_id')
    })
  })
})
