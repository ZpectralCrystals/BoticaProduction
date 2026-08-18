import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import ajustesRoutes from '../routes/ajustes.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
} from './helpers/buildTestApp.js'
import type { FastifyInstance } from 'fastify'

async function buildApp(mockClient: ReturnType<typeof createMockClient>): Promise<FastifyInstance> {
  const app = await buildTestApp(mockClient)
  await app.register(
    async (instance) => {
      await instance.register(ajustesRoutes, { prefix: '/ajustes' })
    },
    { prefix: '/api/v1' },
  )
  await app.ready()
  return app
}

function mockAjusteQueries(mockClient: ReturnType<typeof createMockClient>) {
  mockClient.responses.push(
    { rows: [{ ncantidad: 10, nproducto_id: 1 }] }, // lote SELECT FOR UPDATE
    { rows: [{ nstock: 50 }] },                     // stock SELECT FOR UPDATE
    { rows: [], rowCount: 1 },                       // UPDATE bot_lotes
    { rows: [], rowCount: 1 },                       // UPDATE bot_productos
    { rows: [], rowCount: 1 },                       // INSERT kardex
    { rows: [], rowCount: 1 },                       // INSERT mov_almacen
    { rows: [], rowCount: 1 },                       // INSERT auditoria
  )
}

const ajustePayload = {
  productoId: 1,
  almacenId: 2,
  loteId: 3,
  cantidad: 4,
  motivo: 'AJUSTE_CONTEO',
  detalle: 'Conteo fisico',
}

describe('POST /api/v1/ajustes', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildApp(mockClient)
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('usa POST /api/v1/ajustes como contrato oficial', async () => {
    mockAjusteQueries(mockClient)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ajustes',
      headers: { Authorization: `Bearer ${token}` },
      payload: ajustePayload,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('mantiene POST /api/v1/ajustes/ajustes como alias legacy', async () => {
    mockAjusteQueries(mockClient)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ajustes/ajustes',
      headers: { Authorization: `Bearer ${token}` },
      payload: ajustePayload,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
