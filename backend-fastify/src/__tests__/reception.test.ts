import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import receptionRoutes from '../routes/reception.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
} from './helpers/buildTestApp.js'
import type { FastifyInstance } from 'fastify'

describe('POST /api/v1/recepcion', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(receptionRoutes, { prefix: '/recepcion' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('✅ recepción sube stock, lote, kardex y almacén', async () => {
    let stockUpdateParams: unknown[] | null = null
    let kardexParams: unknown[] | null = null

    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async (sql: string, params?: unknown[]) => {
      if (sql.includes('UPDATE bot_productos')) stockUpdateParams = params ?? null
      if (sql.includes('INSERT INTO bot_kardex')) kardexParams = params ?? null
      return originalQuery(sql, params)
    }

    mockClient.responses.push(
      { rows: [{ nid: 50, ccodigo: 'CMP-20260411-0001', nalmacen_id: 1 }] },
      {
        rows: [{
          nid: 100,
          nproducto_id: 1,
          ncantidad: '50',
          npreunit: '2.5',
          ccodigo_lote: 'L-CMP-001',
          dfecha_vencimiento: '2027-01-01',
          cnotas_lote: null,
          producto_nombre: 'Paracetamol 500mg',
          lrequiere_lote: true,
          lrequiere_vencimiento: true,
        }],
      },
      { rows: [] },
      { rows: [{ today: '20260411' }] },
      { rows: [{ total: '0' }] },
      { rows: [{ nid: 70 }] },
      { rows: [] },
      { rows: [{ nstock: 20 }] },
      { rows: [] },
      { rows: [] },
      { rows: [{ nid: 99 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recepcion',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        compraId: 50,
        items: [{
          detalleId: 100,
          productoId: 1,
          cantidadEsperada: 50,
          cantidadRecibida: 50,
        }],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().codigo).toBe('REC-20260411-0001')
    expect(stockUpdateParams).toEqual([50, 2.5, 1])
    expect(kardexParams).not.toBeNull()
    const kp = (kardexParams as unknown) as unknown[]
    expect(kp[3]).toBe(50)
    expect(kp[4]).toBe(20)
    expect(kp[5]).toBe(70)
  })

  it('❌ bloquea recibir más que pendiente', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 50, ccodigo: 'CMP-20260411-0001', nalmacen_id: 1 }] },
      {
        rows: [{
          nid: 100,
          nproducto_id: 1,
          ncantidad: '50',
          npreunit: '2.5',
          ccodigo_lote: 'L-CMP-001',
          dfecha_vencimiento: '2027-01-01',
          cnotas_lote: null,
          producto_nombre: 'Paracetamol 500mg',
          lrequiere_lote: true,
          lrequiere_vencimiento: true,
        }],
      },
      { rows: [{ ncompra_det_id: 100, recibido: '45' }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/recepcion',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        compraId: 50,
        items: [{
          detalleId: 100,
          productoId: 1,
          cantidadEsperada: 50,
          cantidadRecibida: 10,
        }],
      },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toContain('RECEPCION EXCEDE PENDIENTE')
    expect(mockClient.queries.some((query) => query.sql.includes('UPDATE bot_productos'))).toBe(false)
  })
})
