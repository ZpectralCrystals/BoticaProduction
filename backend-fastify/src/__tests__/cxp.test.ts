import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import cxpRoutes from '../routes/cxp.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
  TEST_USER,
} from './helpers/buildTestApp.js'

describe('POST /api/v1/cuentas-por-pagar/:id/pagar', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(cxpRoutes, { prefix: '/cuentas-por-pagar' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('bloquea solo la CXP base al pagar y registra movimiento de caja', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 5 }] },
      { rows: [{ ncompra_id: 17, compra_codigo: 'CMP-20260511-0012', proveedor: 'Farmadis SAC' }] },
      { rows: [{ nid: 44 }] },
      { rows: [{ pago_id: 77 }] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cuentas-por-pagar/1/pagar',
      headers: { Authorization: `Bearer ${token}` },
      payload: { monto: 3, metodoPago: 'EFECTIVO', documento: 'F8-PAGO', notas: 'Pago parcial' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, pagoId: '77', cajaMovimientoId: '44' })

    const cxpSelect = mockClient.queries.find((query) => query.sql.includes('FROM bot_cuentas_por_pagar x'))
    expect(cxpSelect?.sql).toContain('FOR UPDATE OF x')

    const movimientoInsert = mockClient.queries.find((query) => query.sql.includes('INSERT INTO bot_caja_movimientos'))
    expect(movimientoInsert?.params?.[0]).toBe(5)
    expect(movimientoInsert?.params?.[1]).toBe(3)
  })

  it('rechaza pago CXP si usuario no tiene permiso cxp_pagar', async () => {
    token = makeTestToken(app, { ...TEST_USER, id: 2, super: false, admin: false, permisos: ['cxp_ver'] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/cuentas-por-pagar/1/pagar',
      headers: { Authorization: `Bearer ${token}` },
      payload: { monto: 3, metodoPago: 'EFECTIVO' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('No tienes permiso para realizar esta acción.')
    expect(mockClient.queries).toHaveLength(0)
  })
})

describe('GET /api/v1/cuentas-por-pagar permisos', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(cxpRoutes, { prefix: '/cuentas-por-pagar' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('rechaza listado CXP si usuario no tiene permiso cxp_ver', async () => {
    const token = makeTestToken(app, { ...TEST_USER, id: 3, super: false, admin: false, permisos: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/cuentas-por-pagar',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('No tienes permiso para realizar esta acción.')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('permite listado CXP con permiso cxp_ver', async () => {
    const token = makeTestToken(app, { ...TEST_USER, id: 4, super: false, admin: false, permisos: ['cxp_ver'] })
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/cuentas-por-pagar',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
    expect(mockClient.queries[0].sql).toContain('FROM bot_cuentas_por_pagar x')
  })

  it('rechaza detalle CXP si usuario no tiene permiso cxp_ver', async () => {
    const token = makeTestToken(app, { ...TEST_USER, id: 5, super: false, admin: false, permisos: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/cuentas-por-pagar/1',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('No tienes permiso para realizar esta acción.')
    expect(mockClient.queries).toHaveLength(0)
  })
})
