import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import salesRoutes from '../routes/sales.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
  TEST_USER,
} from './helpers/buildTestApp.js'
import type { FastifyInstance } from 'fastify'

const BASE_ITEM = {
  productoId: 1,
  productoNombre: 'Paracetamol 500mg',
  cantidad: 2,
  precioUnitario: 25,
  total: 50,
}

const BASE_BODY = {
  patient: 'Juan Perez',
  paymentMethod: 'Efectivo',
  total: 50,
  cashier: 'Caja 1',
  area: 'Botica',
  notes: 'Venta de prueba',
  items: [BASE_ITEM],
}

// ────────────────────────────────────────────────────────
// POST /ventas
// ────────────────────────────────────────────────────────
describe('POST /api/v1/ventas', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(salesRoutes, { prefix: '/ventas' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  function seedVentaOK(stock = 100, lotes: any[] = [], seq = '1', ventaId = 999) {
    mockClient.responses.push(
      { rows: [{ nid: 1 }] },                // default almacen lookup
      { rows: [{ nid: 1 }] },                // caja abierta lookup
      { rows: [{ today: '20260411' }] },      // CURRENT_DATE
      { rows: [{ seq }] },                    // codigo sequence
      { rows: [{ nid: ventaId }] },           // venta INSERT
      { rows: [{ cnombre: 'Paracetamol 500mg', nstock: stock, tvencimien: null, npreventa: 25, npreventa_2: null, npreventa_3: null, lrequiere_lote: lotes.length > 0 }] }, // stock SELECT
      { rows: lotes },                         // lotes FEFO SELECT
      { rows: [] },                            // ventas_det INSERT
      { rows: [] },                            // stock UPDATE
      ...(lotes.length > 0
        ? lotes.flatMap(() => [{ rows: [] }, { rows: [] }])  // lote UPDATE + kardex INSERT per lote
        : [{ rows: [] }]),                     // kardex INSERT (sin lote)
      { rows: [] },                            // movimiento_almacen INSERT
      { rows: [] },                            // auditoria INSERT
    )
  }

  it('✅ crea venta y retorna ok + codigo VTA-', async () => {
    seedVentaOK()

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.ok).toBe(true)
    expect(json.codigo).toMatch(/^VTA-/)
    expect(json.id).toBe('999')
  })

  it('✅ genera codigo con secuencia y no usa COUNT(*) + 1', async () => {
    seedVentaOK()

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().codigo).toBe('VTA-20260411-0001')
    expect(mockClient.queries.some((query) => query.sql.includes("nextval('public.bot_ventas_codigo_seq')"))).toBe(true)
    expect(mockClient.queries.some((query) => /COUNT\(\*\)\s*\+\s*1/i.test(query.sql))).toBe(false)
  })

  it('✅ dos ventas seguidas generan codigos distintos', async () => {
    seedVentaOK(100, [], '1', 999)
    seedVentaOK(100, [], '2', 1000)

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(first.json().codigo).toBe('VTA-20260411-0001')
    expect(second.json().codigo).toBe('VTA-20260411-0002')
    expect(first.json().codigo).not.toBe(second.json().codigo)
  })

  it('✅ venta mixta guarda efectivo, digital, vuelto y metodo secundario', async () => {
    let ventaInsertPayload: unknown[] | null = null
    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async function (sql: string, params?: unknown[]) {
      if (sql.includes('INSERT INTO bot_ventas') && !sql.includes('INSERT INTO bot_ventas_det')) {
        ventaInsertPayload = params ?? null
      }
      return originalQuery(sql, params)
    }
    seedVentaOK()

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ...BASE_BODY,
        paymentMethod: 'Mixto',
        total: 200,
        montoEfectivo: 50,
        montoDigital: 150,
        metodoPagoSecundario: 'Yape',
        items: [{ ...BASE_ITEM, cantidad: 8, total: 200 }],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(ventaInsertPayload).not.toBeNull()
    const params = ventaInsertPayload as unknown[]
    expect(params[4]).toBe('Mixto')
    expect(params[10]).toBe(50)
    expect(params[11]).toBe(150)
    expect(params[12]).toBe(0)
    expect(params[13]).toBe('Yape')
  })

  it('✅ venta mixta con efectivo mayor al total guarda digital 0 y vuelto', async () => {
    let ventaInsertPayload: unknown[] | null = null
    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async function (sql: string, params?: unknown[]) {
      if (sql.includes('INSERT INTO bot_ventas') && !sql.includes('INSERT INTO bot_ventas_det')) {
        ventaInsertPayload = params ?? null
      }
      return originalQuery(sql, params)
    }
    seedVentaOK()

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ...BASE_BODY,
        paymentMethod: 'Mixto',
        total: 200,
        montoEfectivo: 250,
        montoDigital: 0,
        metodoPagoSecundario: 'Yape',
        items: [{ ...BASE_ITEM, cantidad: 8, total: 200 }],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(ventaInsertPayload).not.toBeNull()
    const params = ventaInsertPayload as unknown[]
    expect(params[10]).toBe(250)
    expect(params[11]).toBe(0)
    expect(params[12]).toBe(50)
    expect(params[13]).toBe('Yape')
  })

  it('❌ venta mixta no acepta montos negativos', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ...BASE_BODY,
        paymentMethod: 'Mixto',
        montoEfectivo: -1,
        montoDigital: 51,
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('montoEfectivo no puede ser negativo')
    expect(mockClient.queries.some((query) => query.sql.includes('INSERT INTO bot_ventas'))).toBe(false)
  })

  it('❌ rechaza total = 0 con código 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, total: 0 },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('TOTAL INVALIDO')
  })

  it('❌ rechaza venta sin detalle', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, items: [] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('VENTA SIN DETALLE')
  })

  it('❌ rechaza total que no coincide con el detalle', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, total: 1 },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('TOTAL NO COINCIDE CON DETALLE')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('❌ rechaza subtotal de item manipulado', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, items: [{ ...BASE_ITEM, total: 1 }] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('SUBTOTAL DE ITEM INVALIDO')
  })

  it('❌ rechaza sin token de autenticación', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(401)
  })

  it('❌ rechaza venta si el usuario no tiene caja abierta', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 1 }] }, // default almacen lookup
      { rows: [] },           // caja abierta lookup
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('NO HAY CAJA ABIERTA. Abra caja antes de registrar ventas.')
  })

  it('❌ rechaza venta si la caja asignada ya fue cerrada', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 1 }] }, // default almacen lookup
      { rows: [] },           // SELECT solo busca cestado = 'A'; caja cerrada no califica
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('NO HAY CAJA ABIERTA. Abra caja antes de registrar ventas.')
    const cajaQuery = mockClient.queries.find((query) => query.sql.includes('FROM bot_caja'))
    expect(cajaQuery?.sql).toContain("cestado = 'A'")
  })

  it('✅ permite vender al cajero con caja abierta asignada', async () => {
    const cajeroToken = makeTestToken(app, {
      ...TEST_USER,
      id: 2,
      nombre: 'Cajero Asignado',
      super: false,
      admin: false,
      permisos: ['ventas'],
    })
    seedVentaOK()

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${cajeroToken}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    const cajaQuery = mockClient.queries.find((query) => (
      query.sql.includes('FROM bot_caja') && query.sql.includes('nusuario_id = $1')
    ))
    expect(cajaQuery?.params).toEqual([2])
  })

  it('❌ rechaza con STOCK INSUFICIENTE', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 1 }] },                 // default almacen lookup
      { rows: [{ nid: 1 }] },                 // caja abierta lookup
      { rows: [{ today: '20260411' }] },
      { rows: [{ seq: '1' }] },
      { rows: [{ nid: 999 }] },
      { rows: [{ cnombre: 'Paracetamol 500mg', nstock: 1, tvencimien: null, npreventa: 25, npreventa_2: null, npreventa_3: null, lrequiere_lote: false }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, total: 125, items: [{ ...BASE_ITEM, cantidad: 5, total: 125 }] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/STOCK INSUFICIENTE/)
  })

  it('❌ rechaza precio arbitrario no configurado para producto', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 1 }] },
      { rows: [{ nid: 1 }] },
      { rows: [{ today: '20260411' }] },
      { rows: [{ seq: '1' }] },
      { rows: [{ nid: 999 }] },
      { rows: [{ cnombre: 'Paracetamol 500mg', nstock: 100, tvencimien: null, npreventa: 25, npreventa_2: 30, npreventa_3: null, lrequiere_lote: false }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, total: 54, items: [{ ...BASE_ITEM, precioUnitario: 27, total: 54 }] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/PRECIO DE VENTA INVALIDO/)
  })

  it('❌ hace rollback y retorna 500 si un INSERT falla', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 1 }] },                 // default almacen lookup
      { rows: [{ nid: 1 }] },                 // caja abierta lookup
      { rows: [{ today: '20260411' }] },
      { rows: [{ seq: '1' }] },
      { rows: [{ nid: 999 }] },
      { rows: [{ cnombre: 'Paracetamol 500mg', nstock: 100, tvencimien: null, npreventa: 25, npreventa_2: null, npreventa_3: null, lrequiere_lote: false }] },
      { rows: [] },
      new Error('DB connection lost during INSERT'),
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(500)
  })

  it('✅ aplica FEFO — consume el primer lote disponible', async () => {
    const lote = {
      nid: 10,
      ccodigo_lote: 'L-TEST-001',
      dfechavencimiento: '2026-08-01',
      ncantidad: 100,
    }
    seedVentaOK(100, [lote])

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })

  it('❌ FEFO — rechaza si stock en lotes es insuficiente', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 1 }] },                 // default almacen lookup
      { rows: [{ nid: 1 }] },                 // caja abierta lookup
      { rows: [{ today: '20260411' }] },
      { rows: [{ seq: '1' }] },
      { rows: [{ nid: 999 }] },
      { rows: [{ cnombre: 'Paracetamol 500mg', nstock: 100, tvencimien: null, npreventa: 25, npreventa_2: null, npreventa_3: null, lrequiere_lote: true }] },
      { rows: [{ nid: 10, ccodigo_lote: 'L-TEST', dfechavencimiento: '2026-08-01', ncantidad: 1 }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, total: 125, items: [{ ...BASE_ITEM, cantidad: 5, total: 125 }] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/STOCK EN LOTES INSUFICIENTE/)
  })

  it('❌ rechaza producto que requiere lote si no hay lotes vigentes disponibles', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 1 }] },                 // default almacen lookup
      { rows: [{ nid: 1 }] },                 // caja abierta lookup
      { rows: [{ today: '20260411' }] },
      { rows: [{ seq: '1' }] },
      { rows: [{ nid: 999 }] },
      { rows: [{ cnombre: 'Paracetamol 500mg', nstock: 100, tvencimien: null, npreventa: 25, npreventa_2: null, npreventa_3: null, lrequiere_lote: true }] },
      { rows: [] },                           // lotes FEFO SELECT: vencidos/no vigentes quedan filtrados
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/NO HAY LOTES VIGENTES DISPONIBLES/)
  })

  it('✅ kardex generado — stock_nuevo = stock_anterior - cantidad', async () => {
    let kardexInsertPayload: unknown[] | null = null

    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async function (sql: string, params?: unknown[]) {
      if (sql.includes('bot_kardex') && sql.includes('VENTA')) {
        kardexInsertPayload = params ?? null
      }
      return originalQuery(sql, params)
    }

    seedVentaOK(50)

    await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(kardexInsertPayload).not.toBeNull()
    const params = (kardexInsertPayload as unknown) as unknown[]
    expect(Number(params[2])).toBe(-2)
    expect(Number(params[4])).toBe(Number(params[3]) + Number(params[2]))
  })

  it('✅ kardex FEFO conserva saldo global, no saldo aislado del lote', async () => {
    const kardexPayloads: unknown[][] = []
    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async function (sql: string, params?: unknown[]) {
      if (sql.includes('bot_kardex') && sql.includes("'VENTA'")) {
        kardexPayloads.push(params ?? [])
      }
      return originalQuery(sql, params)
    }
    seedVentaOK(150, [
      { nid: 10, ccodigo_lote: 'L-001', dfechavencimiento: '2027-01-01', ncantidad: 1 },
      { nid: 11, ccodigo_lote: 'L-002', dfechavencimiento: '2027-02-01', ncantidad: 20 },
    ])

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ventas',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(200)
    expect(kardexPayloads).toHaveLength(2)
    expect(kardexPayloads[0].slice(5, 7)).toEqual([150, 149])
    expect(kardexPayloads[1].slice(5, 7)).toEqual([149, 148])
  })
})

// ────────────────────────────────────────────────────────
// PATCH /ventas/:id/anular
// ────────────────────────────────────────────────────────
describe('PATCH /api/v1/ventas/:id/anular', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(salesRoutes, { prefix: '/ventas' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('✅ anula venta sin lotes FEFO — revierte stock + kardex', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 5, ccodigo: 'VTA-20260411-0001', cestado: 'A', nalmacen_id: 1 }] },   // SELECT bot_ventas
      { rows: [{ nproducto_id: 1, ncantidad: 2, cdescripcion: 'Paracetamol 500mg' }] }, // SELECT bot_ventas_det
      { rows: [] },                      // SELECT bot_kardex FEFO (sin lotes)
      { rows: [] },                      // UPDATE bot_ventas cestado='C'
      { rows: [{ nstock: 48 }] },        // SELECT bot_productos FOR UPDATE
      { rows: [] },                      // UPDATE bot_productos
      { rows: [] },                      // INSERT bot_kardex ANULACION_VENTA (sin lote)
      { rows: [] },                      // INSERT bot_movimientos_almacen (revert)
      { rows: [] },                      // INSERT bot_auditoria
    )

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/ventas/5/anular',
      headers: { Authorization: `Bearer ${token}` },
      payload: { motivo: 'Error en precio' },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.ok).toBe(true)
    expect(json.codigo).toBe('VTA-20260411-0001')
  })

  it('✅ anula venta con lotes FEFO — restaura bot_lotes + kardex por lote', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 7, ccodigo: 'VTA-20260411-0007', cestado: 'A', nalmacen_id: 1 }] },   // SELECT bot_ventas
      { rows: [{ nproducto_id: 1, ncantidad: 3, cdescripcion: 'Paracetamol 500mg' }] }, // SELECT bot_ventas_det
      // SELECT bot_kardex FEFO — hay un lote consumido
      { rows: [{ kardex_id: 40, nlote_id: 10, ncantidad_abs: 3, ccodigo_lote: 'LOTE-001', nproducto_id: 1 }] },
      { rows: [] },                      // UPDATE bot_ventas cestado='C'
      { rows: [{ nstock: 17 }] },        // SELECT bot_productos FOR UPDATE
      { rows: [] },                      // UPDATE bot_productos (+3 revertido)
      // FEFO loop — lote 10
      { rows: [{ ncantidad: 0 }] },      // SELECT bot_lotes WHERE nid=10 FOR UPDATE
      { rows: [] },                      // UPDATE bot_lotes ncantidad=3, cestado='ACTIVO'
      { rows: [] },                      // INSERT bot_kardex ANULACION_VENTA con lote
      { rows: [] },                      // INSERT bot_movimientos_almacen (revert)
      { rows: [] },                      // INSERT bot_auditoria
    )

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/ventas/7/anular',
      headers: { Authorization: `Bearer ${token}` },
      payload: { motivo: 'Venta duplicada' },
    })

    expect(res.statusCode).toBe(200)
    const json = res.json()
    expect(json.ok).toBe(true)
    expect(json.codigo).toBe('VTA-20260411-0007')

    const kardexQuery = mockClient.queries.find((query) => (
      query.sql.includes('INSERT INTO bot_kardex') && query.sql.includes('ANULACION_VENTA')
    ))
    expect(kardexQuery?.params?.slice(5, 7)).toEqual([17, 20])

    // Verificar que efectivamente se procesaron las queries de lote
    // (el mock vació todas las respuestas = todas las queries se ejecutaron)
    expect(mockClient.responses).toHaveLength(0)
  })

  it('❌ retorna 409 si venta ya estaba anulada', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 5, ccodigo: 'VTA-20260411-0001', cestado: 'C' }] },
    )

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/ventas/5/anular',
      headers: { Authorization: `Bearer ${token}` },
      payload: { motivo: 'Reintento' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().error).toMatch(/ya fue anulada/)
  })

  it('❌ retorna 404 si venta no existe', async () => {
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/ventas/9999/anular',
      headers: { Authorization: `Bearer ${token}` },
      payload: { motivo: 'Test' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('❌ retorna 403 si usuario no es admin', async () => {
    const noAdminToken = makeTestToken(app, {
      ...TEST_USER,
      super: false,
      admin: false,
    })

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/ventas/5/anular',
      headers: { Authorization: `Bearer ${noAdminToken}` },
      payload: { motivo: 'Intento sin permiso' },
    })

    expect(res.statusCode).toBe(403)
  })
})
