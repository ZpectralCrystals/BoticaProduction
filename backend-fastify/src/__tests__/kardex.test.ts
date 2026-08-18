import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import kardexRoutes from '../routes/kardex.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
  TEST_USER,
} from './helpers/buildTestApp.js'
import type { FastifyInstance } from 'fastify'

const KARDEX_ROW = {
  nid: 1,
  nproducto_id: 5,
  producto_nombre: 'Paracetamol 500mg',
  producto_codigo: 'MED-001',
  ctipo: 'VENTA',
  cref_tabla: 'bot_ventas',
  nref_id: 42,
  nlote_id: null,
  ccodigo_lote: null,
  ncantidad: -3,
  nstock_anterior: 20,
  nstock_nuevo: 17,
  cdetalle: 'Paracetamol 500mg',
  nusuario_id: 1,
  cusuario: 'Test Cajero',
  tcreado: '2026-04-11 09:30:00',
}

async function buildApp(mockClient: ReturnType<typeof createMockClient>): Promise<FastifyInstance> {
  const app = await buildTestApp(mockClient)
  await app.register(
    async (instance) => {
      await instance.register(kardexRoutes, { prefix: '/kardex' })
    },
    { prefix: '/api/v1' },
  )
  await app.ready()
  return app
}

describe('GET /api/v1/kardex', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildApp(mockClient)
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('retorna lista paginada de movimientos', async () => {
    mockClient.responses.push(
      { rows: [{ total: '42' }] },
      { rows: [KARDEX_ROW] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.success).toBe(true)
    expect(json.total).toBe(42)
    expect(json.limit).toBe(100)
    expect(json.offset).toBe(0)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].tipo).toBe('VENTA')
    expect(json.data[0].cantidad).toBe(-3)
  })

  it('respeta parámetro offset para paginación', async () => {
    mockClient.responses.push(
      { rows: [{ total: '200' }] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex?limit=50&offset=100',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.limit).toBe(50)
    expect(json.offset).toBe(100)
    expect(json.total).toBe(200)
  })

  it('filtra por producto_id', async () => {
    mockClient.responses.push(
      { rows: [{ total: '5' }] },
      { rows: [KARDEX_ROW] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex?producto_id=5',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data[0].productoId).toBe(5)
  })

  it('filtra por tipo', async () => {
    mockClient.responses.push(
      { rows: [{ total: '3' }] },
      { rows: [KARDEX_ROW] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex?tipo=VENTA',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data[0].tipo).toBe('VENTA')
  })

  it('retorna 401 sin token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/kardex' })
    expect(res.statusCode).toBe(401)
  })

  it('expone loteId y codigoLote cuando el movimiento tiene lote', async () => {
    const rowConLote = {
      ...KARDEX_ROW,
      nlote_id: 10,
      ccodigo_lote: 'L-TEST-001',
    }
    mockClient.responses.push(
      { rows: [{ total: '1' }] },
      { rows: [rowConLote] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.json().data[0].loteId).toBe(10)
    expect(res.json().data[0].codigoLote).toBe('L-TEST-001')
  })
})

describe('GET /api/v1/kardex/:id', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildApp(mockClient)
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('retorna el movimiento cuando existe', async () => {
    mockClient.responses.push({ rows: [KARDEX_ROW] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex/1',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.success).toBe(true)
    expect(json.data.id).toBe(1)
    expect(json.data.tipo).toBe('VENTA')
    expect(json.data.stockAnterior).toBe(20)
    expect(json.data.stockNuevo).toBe(17)
  })

  it('retorna 404 si no existe', async () => {
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex/9999',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('retorna 400 con ID inválido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex/0',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('POST /api/v1/kardex/ajuste', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string
  let tokenNoAdmin: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildApp(mockClient)
    token = makeTestToken(app)
    tokenNoAdmin = makeTestToken(app, { ...TEST_USER, super: false, admin: false })
  })

  afterEach(async () => { await app.close() })

  it('✅ ajuste positivo — aumenta stock y genera kardex AJUSTE', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 5, cnombre: 'Paracetamol 500mg', nstock: 20 }] },
      { rows: [] },
      { rows: [{ nid: 77 }] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kardex/ajuste',
      headers: { Authorization: `Bearer ${token}` },
      payload: { productoId: 5, cantidad: 10, motivo: 'Corrección de inventario físico' },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.success).toBe(true)
    expect(json.stockAnterior).toBe(20)
    expect(json.stockNuevo).toBe(30)
    expect(json.kardexId).toBe(77)
  })

  it('✅ ajuste negativo — reduce stock', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 5, cnombre: 'Paracetamol 500mg', nstock: 20 }] },
      { rows: [] },
      { rows: [{ nid: 78 }] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kardex/ajuste',
      headers: { Authorization: `Bearer ${token}` },
      payload: { productoId: 5, cantidad: -5, motivo: 'Merma por vencimiento detectada en conteo' },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.stockNuevo).toBe(15)
  })

  it('❌ rechaza ajuste directo si producto requiere lote', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 5, cnombre: 'Paracetamol 500mg', nstock: 20, lrequiere_lote: true }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kardex/ajuste',
      headers: { Authorization: `Bearer ${token}` },
      payload: { productoId: 5, cantidad: 10, motivo: 'Corrección de inventario físico' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/AJUSTE REQUIERE LOTE/)
  })

  it('❌ rechaza si el ajuste dejaría stock negativo', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 5, cnombre: 'Paracetamol 500mg', nstock: 3 }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kardex/ajuste',
      headers: { Authorization: `Bearer ${token}` },
      payload: { productoId: 5, cantidad: -10, motivo: 'Test' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/negativo/)
  })

  it('❌ rechaza cantidad = 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kardex/ajuste',
      headers: { Authorization: `Bearer ${token}` },
      payload: { productoId: 5, cantidad: 0, motivo: 'Sin cambio' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/no puede ser 0/)
  })

  it('❌ rechaza sin motivo', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kardex/ajuste',
      headers: { Authorization: `Bearer ${token}` },
      payload: { productoId: 5, cantidad: 10, motivo: '' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/motivo/)
  })

  it('❌ retorna 403 si usuario no es admin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kardex/ajuste',
      headers: { Authorization: `Bearer ${tokenNoAdmin}` },
      payload: { productoId: 5, cantidad: 10, motivo: 'Ajuste no autorizado' },
    })

    expect(res.statusCode).toBe(403)
  })

  it('❌ retorna 404 si producto no existe', async () => {
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/kardex/ajuste',
      headers: { Authorization: `Bearer ${token}` },
      payload: { productoId: 9999, cantidad: 10, motivo: 'Test 404' },
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/v1/kardex/resumen/:productoId', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildApp(mockClient)
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('retorna resumen por tipo para un producto', async () => {
    mockClient.responses.push(
      { rows: [{ cnombre: 'Paracetamol 500mg', ccodigo: 'MED-001', nstock: 17 }] },
      {
        rows: [
          { ctipo: 'COMPRA', cantidad_movimientos: 2, unidades_neto: 50, primer_movimiento: '2026-01-01', ultimo_movimiento: '2026-03-01' },
          { ctipo: 'VENTA', cantidad_movimientos: 8, unidades_neto: -33, primer_movimiento: '2026-01-20', ultimo_movimiento: '2026-04-11' },
        ],
      },
      { rows: [{ nstock: 17 }] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex/resumen/5',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.success).toBe(true)
    expect(json.data.stockActual).toBe(17)
    expect(json.data.resumenPorTipo).toHaveLength(2)
    const compra = json.data.resumenPorTipo.find((r: any) => r.tipo === 'COMPRA')
    expect(compra.unidadesNeto).toBe(50)
  })

  it('retorna 404 si el producto no existe', async () => {
    mockClient.responses.push({ rows: [] }, { rows: [] }, { rows: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/kardex/resumen/9999',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})
