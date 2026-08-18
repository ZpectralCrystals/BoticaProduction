import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import usersRoutes from '../routes/users.routes.js'
import {
  TEST_USER,
  buildTestApp,
  createMockClient,
  makeTestToken,
} from './helpers/buildTestApp.js'

describe('usuarios Clerk link management', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(usersRoutes, { prefix: '/usuarios' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('lists current Clerk link status in GET /usuarios', async () => {
    mockClient.responses.push(
      { rows: [{ exists: true }] },
      {
        rows: [
          {
            nid: 7,
            cnrodni: '12345678',
            cnombre: 'Usuario ERP',
            crol: 'caja',
            cestado: 'A',
            lsuper: false,
            ladmin: false,
            cclerk_user_id: 'user_2xYabc123',
            tcreado: '2026-04-13T10:00:00.000Z',
          },
        ],
      },
      { rows: [{ cseccion: 'ventas' }, { cseccion: 'compras' }] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/usuarios',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      expect.objectContaining({
        id: '7',
        clerkLinked: true,
        clerkUserId: 'user_2xYabc123',
      }),
    ])
  })

  it('lists users without failing when cclerk_user_id column is missing', async () => {
    mockClient.responses.push(
      { rows: [{ exists: false }] },
      {
        rows: [
          {
            nid: 7,
            cnrodni: '12345678',
            cnombre: 'Usuario ERP',
            crol: 'caja',
            cestado: 'A',
            cclerk_user_id: null,
            tcreado: '2026-04-13T10:00:00.000Z',
          },
        ],
      },
      { rows: [{ cseccion: 'ventas' }] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/usuarios',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()[0]).toEqual(
      expect.objectContaining({
        id: '7',
        clerkLinked: false,
        clerkUserId: null,
        permisos: ['ventas'],
      }),
    )
  })

  it('returns Clerk link status for a single user', async () => {
    mockClient.responses.push(
      { rows: [{ exists: true }] },
      {
        rows: [
          {
            nid: 7,
            cnombre: 'Usuario ERP',
            cnrodni: '12345678',
            cestado: 'A',
            cclerk_user_id: 'user_2xYabc123',
          },
        ],
      },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/usuarios/7/clerk-link',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      userId: '7',
      nombre: 'Usuario ERP',
      dni: '12345678',
      estado: 'A',
      clerkLinked: true,
      clerkUserId: 'user_2xYabc123',
    })
  })

  it('rejects linking when clerkUserId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/usuarios/7/clerk-link',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('clerkUserId es obligatorio')
  })

  it('rejects linking inactive ERP users', async () => {
    mockClient.responses.push(
      { rows: [{ exists: true }] },
      {
        rows: [
          {
            nid: 7,
            cnombre: 'Usuario ERP',
            cnrodni: '12345678',
            cestado: 'I',
            cclerk_user_id: null,
          },
        ],
      },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/usuarios/7/clerk-link',
      headers: { authorization: `Bearer ${token}` },
      payload: { clerkUserId: 'user_2xYabc123' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Solo se puede vincular Clerk a usuarios ERP activos')
  })

  it('rejects duplicate Clerk IDs linked to another ERP user', async () => {
    mockClient.responses.push(
      { rows: [{ exists: true }] },
      {
        rows: [
          {
            nid: 7,
            cnombre: 'Usuario ERP',
            cnrodni: '12345678',
            cestado: 'A',
            cclerk_user_id: null,
          },
        ],
      },
      { rows: [{ nid: 10, cnombre: 'Otro usuario' }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/usuarios/7/clerk-link',
      headers: { authorization: `Bearer ${token}` },
      payload: { clerkUserId: 'user_2xYabc123' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().message).toContain('Ese Clerk User ID ya está vinculado')
  })

  it('links Clerk user IDs safely', async () => {
    let updateParams: unknown[] | undefined

    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async (sql: string, params?: unknown[]) => {
      if (sql.includes('UPDATE bot_usuarios') && sql.includes('cclerk_user_id')) {
        updateParams = params
      }
      return originalQuery(sql, params)
    }

    mockClient.responses.push(
      { rows: [{ exists: true }] },
      {
        rows: [
          {
            nid: 7,
            cnombre: 'Usuario ERP',
            cnrodni: '12345678',
            cestado: 'A',
            cclerk_user_id: null,
          },
        ],
      },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/usuarios/7/clerk-link',
      headers: { authorization: `Bearer ${token}` },
      payload: { clerkUserId: 'user_2xYabc123' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(
      expect.objectContaining({
        ok: true,
        clerkLinked: true,
        clerkUserId: 'user_2xYabc123',
      }),
    )
    expect(updateParams).toEqual(['user_2xYabc123', 7])
  })

  it('unlinks Clerk user IDs safely', async () => {
    let updateParams: unknown[] | undefined

    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async (sql: string, params?: unknown[]) => {
      if (sql.includes('UPDATE bot_usuarios') && sql.includes('cclerk_user_id = NULL')) {
        updateParams = params
      }
      return originalQuery(sql, params)
    }

    mockClient.responses.push(
      { rows: [{ exists: true }] },
      {
        rows: [
          {
            nid: 7,
            cnombre: 'Usuario ERP',
            cnrodni: '12345678',
            cestado: 'A',
            cclerk_user_id: 'user_2xYabc123',
          },
        ],
      },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/v1/usuarios/7/clerk-link',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual(
      expect.objectContaining({
        ok: true,
        clerkLinked: false,
        clerkUserId: null,
      }),
    )
    expect(updateParams).toEqual([7])
  })

  it('forbids Clerk link management for non-admin users', async () => {
    const restrictedToken = makeTestToken(app, {
      ...TEST_USER,
      super: false,
      admin: false,
      permisos: ['ventas'],
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/usuarios/7/clerk-link',
      headers: { authorization: `Bearer ${restrictedToken}` },
      payload: { clerkUserId: 'user_2xYabc123' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('NO TIENE PERMISOS PARA GESTIONAR USUARIOS')
  })
})
