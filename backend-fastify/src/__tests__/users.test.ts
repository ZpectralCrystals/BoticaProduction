import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import usersRoutes, { replaceClerkUserEmail, type ClerkEmailAdminClient } from '../routes/users.routes.js'
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
      clerkEmail: null,
    })
  })

  it('validates Clerk directory searches', async () => {
    const shortQuery = await app.inject({
      method: 'GET',
      url: '/api/v1/usuarios/clerk/search?q=a',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(shortQuery.statusCode).toBe(400)

    const missingConfig = await app.inject({
      method: 'GET',
      url: '/api/v1/usuarios/clerk/search?q=usuario',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(missingConfig.statusCode).toBe(503)
    expect(missingConfig.json().message).toContain('CLERK_SECRET_KEY')
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

  it('rejects invalid Clerk emails before changing external identity', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/usuarios/7/clerk-email',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'correo-invalido' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Ingrese un correo Clerk válido')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('requires Clerk server configuration to edit a linked email', async () => {
    mockClient.responses.push(
      { rows: [{ exists: true }] },
      {
        rows: [{
          nid: 7,
          cnombre: 'Usuario ERP',
          cnrodni: '12345678',
          cestado: 'A',
          cclerk_user_id: 'user_2xYabc123',
        }],
      },
    )

    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/usuarios/7/clerk-email',
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'nuevo@example.com' },
    })

    expect(res.statusCode).toBe(503)
    expect(res.json().message).toContain('CLERK_SECRET_KEY')
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

  it('promotes an existing Clerk email before removing the old one', async () => {
    const calls: string[] = []
    const clerkClient = {
      users: {
        getUser: async () => ({
          banned: false,
          primaryEmailAddress: { id: 'email_old', emailAddress: 'old@example.com' },
          emailAddresses: [
            { id: 'email_old', emailAddress: 'old@example.com' },
            { id: 'email_new', emailAddress: 'new@example.com' },
          ],
        }),
      },
      emailAddresses: {
        createEmailAddress: async () => {
          throw new Error('No debe crear un correo existente')
        },
        updateEmailAddress: async (id: string) => {
          calls.push(`update:${id}`)
          return { id, emailAddress: 'new@example.com' }
        },
        deleteEmailAddress: async (id: string) => {
          calls.push(`delete:${id}`)
        },
      },
    } as ClerkEmailAdminClient

    const result = await replaceClerkUserEmail(clerkClient, 'user_123', 'new@example.com')

    expect(calls).toEqual(['update:email_new', 'delete:email_old'])
    expect(result).toEqual({ email: 'new@example.com', removedEmails: ['old@example.com'] })
  })

  it('creates the new primary Clerk email before removing previous emails', async () => {
    const calls: string[] = []
    const clerkClient = {
      users: {
        getUser: async () => ({
          banned: false,
          primaryEmailAddress: { id: 'email_old', emailAddress: 'old@example.com' },
          emailAddresses: [{ id: 'email_old', emailAddress: 'old@example.com' }],
        }),
      },
      emailAddresses: {
        createEmailAddress: async (params: { emailAddress: string }) => {
          calls.push(`create:${params.emailAddress}`)
          return { id: 'email_new', emailAddress: params.emailAddress }
        },
        updateEmailAddress: async () => {
          throw new Error('No debe actualizar un correo inexistente')
        },
        deleteEmailAddress: async (id: string) => {
          calls.push(`delete:${id}`)
        },
      },
    } as ClerkEmailAdminClient

    const result = await replaceClerkUserEmail(clerkClient, 'user_123', 'new@example.com')

    expect(calls).toEqual(['create:new@example.com', 'delete:email_old'])
    expect(result).toEqual({ email: 'new@example.com', removedEmails: ['old@example.com'] })
  })
})
