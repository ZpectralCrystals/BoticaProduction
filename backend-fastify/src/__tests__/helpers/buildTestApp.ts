import { vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import type pg from 'pg'
import type { AuthUser } from '../../plugins/auth.js'
import drizzlePlugin from '../../plugins/drizzle.js'

export const TEST_JWT_SECRET = 'botica-fastify-local-secret'

export const TEST_USER: AuthUser = {
  id: 1,
  nombre: 'Test Cajero',
  rol: 'ADMIN',
  dni: '12345678',
  username: 'test.cajero',
  super: true,
  admin: true,
  supervisor: false,
  permisos: ['ventas', 'compras', 'admin'],
}

type MockResponse = { rows: any[]; rowCount?: number }

export function createMockClient() {
  const responses: Array<MockResponse | Error> = []
  const queries: Array<{ sql: string; params?: unknown[] }> = []

  const client = {
    responses,
    queries,
    async query(sql: string, params?: unknown[]) {
      queries.push({ sql, params })
      const trimmed = sql.trim().toUpperCase()
      if (trimmed === 'BEGIN' || trimmed === 'COMMIT' || trimmed === 'ROLLBACK') {
        return { rows: [], rowCount: 0 }
      }
      const next = client.responses.shift()
      if (!next) return { rows: [], rowCount: 0 }
      if (next instanceof Error) throw next
      const r = next as MockResponse
      return { rows: r.rows, rowCount: r.rowCount ?? r.rows.length }
    },
    release: vi.fn(),
  }
  return client
}

export async function buildTestApp(
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

  await app.register(drizzlePlugin)

  await app.register(
    fp(
      async (fastify) => {
        fastify.decorate('requireAuth', async (request: any, reply: any) => {
          try {
            const token =
              request.cookies?.botica_token ||
              request.headers.authorization?.slice(7)
            if (!token) {
              reply.code(401).send({ error: 'NO HA INICIADO SESION' })
              return
            }
            const payload = await fastify.jwt.verify<AuthUser>(token)
            request.authUser = payload
          } catch {
            reply.code(401).send({ error: 'NO HA INICIADO SESION' })
          }
        })
        fastify.decorate('hasAnyPermission', (user: AuthUser | null, sections: string[], allowAdmin = true) => {
          if (!user) return false
          if (allowAdmin && (user.super || user.admin)) return true
          return sections.some((section) => user.permisos.includes(section))
        })
        fastify.decorate('requireAnyPermission', async (request: any, reply: any, sections: string[], options?: { allowAdmin?: boolean; errorMessage?: string }) => {
          const user = request.authUser
          if (!user) {
            reply.code(401).send({ error: 'NO HA INICIADO SESION' })
            return false
          }
          if (fastify.hasAnyPermission(user, sections, options?.allowAdmin ?? true)) {
            return true
          }
          reply.code(403).send({
            error: 'FORBIDDEN',
            message: options?.errorMessage ?? `Permiso insuficiente. Se requiere acceso a: ${sections.join(', ')}`,
          })
          return false
        })
        fastify.decorate('buildAuthUser', async () => TEST_USER)
        fastify.addHook('preHandler', async (request: any) => {
          request.authUser = null
        })
      },
      { name: 'auth' },
    ),
  )

  return app
}

export function makeTestToken(app: FastifyInstance, user: AuthUser = TEST_USER): string {
  return app.jwt.sign(user)
}
