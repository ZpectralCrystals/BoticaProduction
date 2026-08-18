import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import inventoryRoutes from '../routes/inventory.routes.js'
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
      await instance.register(inventoryRoutes, { prefix: '/inventario' })
    },
    { prefix: '/api/v1' },
  )
  await app.ready()
  return app
}

describe('POST /api/v1/inventario action updatePrices', () => {
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

  it('actualiza solo precios comerciales sin tocar stock ni lotes', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 7 }], rowCount: 1 },  // SELECT producto FOR UPDATE
      { rows: [], rowCount: 1 },             // UPSERT PRECIO_1
      { rows: [], rowCount: 1 },             // UPSERT PRECIO_2
      { rows: [], rowCount: 1 },             // UPDATE lactivo=FALSE para PRECIO_3 (valor null)
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventario',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        action: 'updatePrices',
        id: '7',
        precioVenta1: 18.9,
        precioVenta2: 20.5,
        precioVenta3: null,
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, id: '7' })

    // Verifica que el flujo escribe a la tabla canónica producto_precios
    const sqlConcat = mockClient.queries.map((q) => q.sql).join('\n')
    expect(sqlConcat).toContain('bot_producto_precios')
    expect(sqlConcat).not.toContain('nstock')
    expect(sqlConcat).not.toContain('nprecompra =')

    // Validar slots procesados
    const upsertQueries = mockClient.queries.filter((q) => q.sql.includes('INSERT INTO bot_producto_precios'))
    expect(upsertQueries.length).toBe(2) // PRECIO_1 + PRECIO_2 (PRECIO_3 desactiva con UPDATE)
    expect(upsertQueries[0].params?.[1]).toBe('PRECIO_1')
    expect(upsertQueries[0].params?.[2]).toBe('18.90')
    expect(upsertQueries[1].params?.[1]).toBe('PRECIO_2')
    expect(upsertQueries[1].params?.[2]).toBe('20.50')

    const deactivateQuery = mockClient.queries.find(
      (q) => q.sql.includes('UPDATE bot_producto_precios') && q.sql.includes('lactivo = FALSE'),
    )
    expect(deactivateQuery).toBeTruthy()
    expect(deactivateQuery?.params?.[3]).toBe('PRECIO_3')
  })

  it('rechaza precios negativos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventario',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        action: 'updatePrices',
        id: '7',
        precioVenta1: -1,
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('LOS PRECIOS NO PUEDEN SER NEGATIVOS')
  })
})

describe('POST /api/v1/inventario tipoProducto', () => {
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

  it('mantiene composicion obligatoria para medicamento', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventario',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Paracetamol 500mg',
        tipoProducto: 'MEDICAMENTO',
        category: 'Medicamentos',
        componentes: [],
        precioVenta1: 10,
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('COMPOSICION ES OBLIGATORIA')
  })

  it('permite producto no medicamento sin composicion obligatoria', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/inventario',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        name: 'Bolsa plastica',
        tipoProducto: 'NO_MEDICAMENTO',
        category: 'Accesorios',
        componentes: [],
        precioVenta1: 0,
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('PRECIO VENTA 1 DEBE SER MAYOR A CERO')
  })
})

describe('GET /api/v1/inventario/precios/historial/:productoId', () => {
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

  it('retorna historial de precios normalizado para UI', async () => {
    mockClient.responses.push({
      rows: [
        {
          nid: 12,
          cnombre: 'PRECIO_1',
          nprecio_anterior: '10.00',
          nprecio_nuevo: '12.50',
          caccion: 'UPDATE',
          cusuario: 'Admin',
          tcreado: '2026-05-11 10:00:00',
        },
      ],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/inventario/precios/historial/7',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      {
        nid: '12',
        slot: 'PRECIO_1',
        precioAnterior: 10,
        precioNuevo: 12.5,
        accion: 'UPDATE',
        usuario: 'Admin',
        fecha: '2026-05-11 10:00:00',
      },
    ])
    expect(mockClient.queries[0].sql).toContain('bot_producto_precios_hist')
    expect(mockClient.queries[0].params).toEqual([7])
  })
})
