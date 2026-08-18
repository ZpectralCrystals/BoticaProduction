import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import consistenciaRoutes from '../routes/consistencia.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
} from './helpers/buildTestApp.js'
import type { FastifyInstance } from 'fastify'

describe('GET /api/v1/consistencia/resumen', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(consistenciaRoutes, { prefix: '/consistencia' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('returns resumen with zero inconsistencies on clean system', async () => {
    // Stock vs Lotes aggregation
    mockClient.responses.push({ rows: [{ stock_vs_lotes: 0, stock_sin_lotes: 0 }] })
    // Lotes integrity
    mockClient.responses.push({ rows: [{ vencidos_no_marcados: 0, sin_almacen: 0 }] })
    // Kardex desync
    mockClient.responses.push({ rows: [{ kardex_desync: 0, kardex_negativos: 0 }] })
    // Almacen stock
    mockClient.responses.push({ rows: [{ stock_vendible: 100, stock_no_vendible: 20, almacenes_activos: 3 }] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consistencia/resumen',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.estadoGeneral).toBe('OK')
    expect(body.totalInconsistencias).toBe(0)
    expect(body.stockVendible).toBe(100)
    expect(body.stockNoVendible).toBe(20)
    expect(body.checks).toHaveLength(6)
  })

  it('detects critical inconsistency', async () => {
    mockClient.responses.push({ rows: [{ stock_vs_lotes: 3, stock_sin_lotes: 1 }] })
    mockClient.responses.push({ rows: [{ vencidos_no_marcados: 2, sin_almacen: 0 }] })
    mockClient.responses.push({ rows: [{ kardex_desync: 1, kardex_negativos: 0 }] })
    mockClient.responses.push({ rows: [{ stock_vendible: 50, stock_no_vendible: 10, almacenes_activos: 2 }] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consistencia/resumen',
      headers: { authorization: `Bearer ${token}` },
    })

    const body = res.json()
    expect(body.estadoGeneral).toBe('CRITICA')
    expect(body.totalInconsistencias).toBe(7)
  })
})

describe('GET /api/v1/consistencia/stock', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(consistenciaRoutes, { prefix: '/consistencia' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('returns empty when no inconsistencies', async () => {
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consistencia/stock',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.totalInconsistencias).toBe(0)
    expect(mockClient.queries[0].sql).toContain('COALESCE(p.lrequiere_lote, TRUE) = TRUE')
  })

  it('returns inconsistencies when stock differs from lotes', async () => {
    mockClient.responses.push({
      rows: [{
        producto_id: 1, producto_codigo: 'MED-001', producto_nombre: 'Paracetamol',
        stock_tabla: 50, stock_lotes_activos: 30, stock_lotes_total: 30,
        diferencia: 20, lotes_con_stock: 2, lotes_sin_almacen: 0,
      }],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consistencia/stock',
      headers: { authorization: `Bearer ${token}` },
    })

    const body = res.json()
    expect(body.totalInconsistencias).toBe(1)
    expect(body.inconsistencias[0].diferencia).toBe(20)
    expect(body.inconsistencias[0].severidad).toBe('CRITICA')
  })
})

describe('GET /api/v1/consistencia/alertas', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(consistenciaRoutes, { prefix: '/consistencia' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('returns alert categories', async () => {
    // porVencer
    mockClient.responses.push({ rows: [] })
    // enCuarentena
    mockClient.responses.push({ rows: [] })
    // enBaja
    mockClient.responses.push({ rows: [] })
    // stockFantasma
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/consistencia/alertas',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.success).toBe(true)
    expect(body.porVencer).toBeDefined()
    expect(body.enCuarentena).toBeDefined()
    expect(body.enBaja).toBeDefined()
    expect(body.stockFantasma).toBeDefined()
  })
})

describe('POST /api/v1/consistencia/reconciliar', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(consistenciaRoutes, { prefix: '/consistencia' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('dry run returns corrections without applying', async () => {
    mockClient.responses.push({
      rows: [{
        producto_id: 1, producto_codigo: 'MED-001', producto_nombre: 'Test',
        stock_actual: 50, stock_correcto: 30,
      }],
    })
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/consistencia/reconciliar',
      headers: { authorization: `Bearer ${token}` },
      payload: { dryRun: true },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.dryRun).toBe(true)
    expect(body.totalCorregidos).toBe(1)
    expect(body.correcciones[0].stockAnterior).toBe(50)
    expect(body.correcciones[0].stockCorrecto).toBe(30)
    expect(mockClient.queries[0].sql).toContain('COALESCE(p.lrequiere_lote, TRUE) = TRUE')
  })

  it('detecta desajuste exclusivo de Kardex sin alterar stock', async () => {
    mockClient.responses.push(
      { rows: [] },
      {
        rows: [{
          producto_id: 7,
          producto_codigo: 'MED-007',
          producto_nombre: 'Producto FEFO',
          stock_kardex: 3,
          stock_actual: 6,
        }],
      },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/consistencia/reconciliar',
      headers: { authorization: `Bearer ${token}` },
      payload: { dryRun: true },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      dryRun: true,
      totalCorregidos: 1,
      totalStockCorregido: 0,
      totalKardexAlineado: 1,
      correcciones: [],
      alineacionesKardex: [{ productoId: 7, stockKardex: 3, stockActual: 6 }],
    })
    expect(mockClient.queries.some((query) => query.sql.includes('UPDATE bot_productos'))).toBe(false)
  })

  it('aplica alineación Kardex con movimiento cero auditable', async () => {
    mockClient.responses.push(
      { rows: [] },
      {
        rows: [{
          producto_id: 7,
          producto_codigo: 'MED-007',
          producto_nombre: 'Producto FEFO',
          stock_kardex: 3,
          stock_actual: 6,
        }],
      },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/consistencia/reconciliar',
      headers: { authorization: `Bearer ${token}` },
      payload: { dryRun: false },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().totalKardexAlineado).toBe(1)
    const insert = mockClient.queries.find((query) => query.sql.includes('RECONCILIACION_KARDEX'))
    expect(insert?.params?.slice(0, 3)).toEqual([7, 3, 6])
    expect(mockClient.queries.some((query) => query.sql.includes('UPDATE bot_productos'))).toBe(false)
    expect(mockClient.queries.at(-1)?.sql).toBe('COMMIT')
  })
})
