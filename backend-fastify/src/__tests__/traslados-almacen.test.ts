import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import trasladosAlmacenRoutes from '../routes/traslados-almacen.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
} from './helpers/buildTestApp.js'
import type { FastifyInstance } from 'fastify'

describe('POST /api/v1/traslados-almacen', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(trasladosAlmacenRoutes, { prefix: '/traslados-almacen' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('rejects missing productoId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/traslados-almacen',
      headers: { authorization: `Bearer ${token}` },
      payload: { almacenOrigenId: 1, almacenDestinoId: 2, cantidad: 10 },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('productoId')
  })

  it('rejects same origin and destination', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/traslados-almacen',
      headers: { authorization: `Bearer ${token}` },
      payload: { productoId: 1, almacenOrigenId: 1, almacenDestinoId: 1, cantidad: 10 },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('diferentes')
  })

  it('transfers specific lote between warehouses', async () => {
    // Validate origen
    mockClient.responses.push({ rows: [{ nid: 1, cnombre: 'Origen', cestado: 'A' }] })
    // Validate destino
    mockClient.responses.push({ rows: [{ nid: 2, cnombre: 'Destino', cestado: 'A' }] })
    // Validate producto
    mockClient.responses.push({ rows: [{ cnombre: 'Paracetamol', nstock: 100 }] })
    // Lote query
    mockClient.responses.push({
      rows: [{
        nid: 10, nproducto_id: 1, ncantidad: 50, nalmacen_id: 1,
        ccodigo_lote: 'L-001', nversion: 1, dfechavencimiento: '2026-12-31', ncompra_id: null,
      }],
    })
    // Update lote (entire move since cantidad == 50 below... wait, test uses 50 below)
    // Actually the test sends cantidad: 20, loteId: 10
    // Since 20 < 50 → partial path
    // Update lote (reduce)
    mockClient.responses.push({ rows: [], rowCount: 1 })
    // Get orig lote for new
    mockClient.responses.push({ rows: [{ ccodigo_lote: 'L-001', dfechavencimiento: '2026-12-31', ncompra_id: null }] })
    // Insert new lote
    mockClient.responses.push({ rows: [] })
    // Insert movimiento
    mockClient.responses.push({ rows: [] })
    // Insert kardex
    mockClient.responses.push({ rows: [] })
    // Insert auditoria
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/traslados-almacen',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        productoId: 1,
        loteId: 10,
        almacenOrigenId: 1,
        almacenDestinoId: 2,
        cantidad: 20,
        motivo: 'Rebalanceo',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.cantidad).toBe(20)
    expect(body.almacenOrigen.nombre).toBe('Origen')
    expect(body.almacenDestino.nombre).toBe('Destino')
  })
})

describe('POST /api/v1/traslados-almacen/devolucion-cliente', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(trasladosAlmacenRoutes, { prefix: '/traslados-almacen' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('processes customer return to quarantine', async () => {
    // almacen
    mockClient.responses.push({ rows: [{ cnombre: 'Cuarentena', cestado: 'A' }] })
    // producto
    mockClient.responses.push({ rows: [{ cnombre: 'Paracetamol', nstock: 80 }] })
    // update stock
    mockClient.responses.push({ rows: [] })
    // insert lote
    mockClient.responses.push({ rows: [] })
    // insert movimiento
    mockClient.responses.push({ rows: [] })
    // insert kardex
    mockClient.responses.push({ rows: [] })
    // insert auditoria
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/traslados-almacen/devolucion-cliente',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        productoId: 1,
        almacenDestinoId: 3,
        cantidad: 5,
        motivo: 'Producto defectuoso',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ok).toBe(true)
    expect(body.cantidad).toBe(5)
    expect(body.almacen).toBe('Cuarentena')
  })
})

describe('POST /api/v1/traslados-almacen/devolucion-proveedor', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(trasladosAlmacenRoutes, { prefix: '/traslados-almacen' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('processes supplier return with specific lote', async () => {
    // almacen
    mockClient.responses.push({ rows: [{ cnombre: 'Disponible' }] })
    // producto
    mockClient.responses.push({ rows: [{ nstock: 100 }] })
    // lote
    mockClient.responses.push({ rows: [{ ncantidad: 30, nversion: 1 }] })
    // update lote
    mockClient.responses.push({ rows: [], rowCount: 1 })
    // update stock
    mockClient.responses.push({ rows: [] })
    // movimiento
    mockClient.responses.push({ rows: [] })
    // kardex
    mockClient.responses.push({ rows: [] })
    // auditoria
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/traslados-almacen/devolucion-proveedor',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        productoId: 1,
        loteId: 10,
        almacenOrigenId: 1,
        cantidad: 15,
        motivo: 'Lote defectuoso',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(res.json().cantidad).toBe(15)
  })
})

describe('GET /api/v1/traslados-almacen', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(trasladosAlmacenRoutes, { prefix: '/traslados-almacen' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('returns transfer history', async () => {
    mockClient.responses.push({
      rows: [{
        nid: 1, nproducto_id: 1, producto_nombre: 'Paracetamol', producto_codigo: 'MED-001',
        nlote_id: null, nalmacen_origen_id: 1, almacen_origen: 'Origen',
        nalmacen_destino_id: 2, almacen_destino: 'Destino',
        ncantidad: 10, cdetalle: 'Test', cusuario: 'Admin', tcreado: '2026-01-01',
      }],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/traslados-almacen',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].cantidad).toBe(10)
  })
})
