import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import purchasesRoutes from '../routes/purchases.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
} from './helpers/buildTestApp.js'
import type { FastifyInstance } from 'fastify'

const BASE_ITEM = {
  productoId: 1,
  cantidad: 50,
  precioUnit: 2.5,
  codigoLote: 'L-CMP-001',
  fechaVencimiento: '2027-01-01',
}

const BASE_BODY = {
  proveedorId: 10,
  almacenId: 1,
  tipoComprobante: 'FACTURA',
  numeroDocumento: 'F001-0001',
  notas: 'Compra de prueba',
  items: [BASE_ITEM],
}

describe('POST /api/v1/compras', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(purchasesRoutes, { prefix: '/compras' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  function seedCompraOK(stockPrev = 20, loteExiste = false, cajaAbierta = true, seq = '1', compraId = 50) {
    mockClient.responses.push(
      {
        rows: [
          { table_name: 'bot_almacenes' },
          { table_name: 'bot_locales' },
          { table_name: 'bot_movimientos_almacen' },
        ],
      },                                                    // tables schema check
      {
        rows: [
          { table_name: 'bot_compras', column_name: 'ctipo_comprobante' },
          { table_name: 'bot_compras', column_name: 'nalmacen_id' },
          { table_name: 'bot_lotes', column_name: 'nalmacen_id' },
          { table_name: 'bot_kardex', column_name: 'nalmacen_id' },
        ],
      },                                                    // columns schema check
      {
        rows: [{
          nid: 1,
          cnombre: 'Paracetamol 500mg',
          lrequiere_lote: true,
          lrequiere_vencimiento: true,
        }],
      }, // product validation
      { rows: [{ cnombre: 'Distribuidora Farma SAC' }] },  // provider validation
      { rows: [{ nid: 1, cnombre: 'Disponible Principal', ctipo_almacen: 'DISPONIBLE' }] }, // almacen validation
      { rows: cajaAbierta ? [{ nid: 5 }] : [] },             // caja SELECT (CONTADO branch)
      { rows: [{ today: '20260411' }] },                     // CURRENT_DATE
      { rows: [{ seq }] },                                   // codigo sequence
      { rows: [{ nid: compraId }] },                         // purchase INSERT
      { rows: [] },                                           // compras_det INSERT
      { rows: [{ nstock: stockPrev }] },                      // stock SELECT FOR UPDATE
      { rows: [] },                                           // stock UPDATE
      { rows: loteExiste ? [{ nid: 7 }] : [] },              // lote SELECT FOR UPDATE
      { rows: loteExiste ? [] : [{ nid: 99 }] },             // lote INSERT (RETURNING) o UPDATE
      { rows: [] },                                           // kardex INSERT
      { rows: [] },                                           // movimiento_almacen INSERT
      { rows: cajaAbierta ? [] : [] },                       // caja_movimientos INSERT (solo si caja)
      { rows: [] },                                           // auditoria INSERT
    )
  }

  it('✅ crea compra, aumenta stock y genera kardex COMPRA', async () => {
    let kardexParams: unknown[] | null = null

    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async (sql: string, params?: unknown[]) => {
      if (sql.includes('bot_kardex') && sql.includes('COMPRA')) {
        kardexParams = params ?? null
      }
      return originalQuery(sql, params)
    }

    seedCompraOK(20)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(res.json().codigo).toMatch(/^CMP-/)

    expect(kardexParams).not.toBeNull()
    const kp = (kardexParams as unknown) as unknown[]
    // Nuevo orden: [productoId, nloteId, compraId, cantidad, stockPrev, stockNew, detalle, userId, userName, almacenId]
    const stockPrev = Number(kp[4])
    const stockNew = Number(kp[5])
    expect(stockNew).toBe(stockPrev + 50)
    expect(kp[1]).toBeTruthy() // nlote_id presente en kardex
  })

  it('✅ genera codigo con secuencia y no usa COUNT(*) + 1', async () => {
    seedCompraOK(20)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().codigo).toBe('CMP-20260411-0001')
    expect(mockClient.queries.some((query) => query.sql.includes("nextval('public.bot_compras_codigo_seq')"))).toBe(true)
    expect(mockClient.queries.some((query) => /COUNT\(\*\)\s*\+\s*1/i.test(query.sql))).toBe(false)
  })

  it('✅ dos compras seguidas generan codigos distintos', async () => {
    seedCompraOK(20, false, true, '1', 50)
    seedCompraOK(20, false, true, '2', 51)

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(first.json().codigo).toBe('CMP-20260411-0001')
    expect(second.json().codigo).toBe('CMP-20260411-0002')
    expect(first.json().codigo).not.toBe(second.json().codigo)
  })

  it('✅ crea lote nuevo si no existía (INSERT bot_lotes)', async () => {
    let loteInserted = false

    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT') && sql.includes('bot_lotes')) {
        loteInserted = true
      }
      return originalQuery(sql, params)
    }

    seedCompraOK(20, false)

    await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(loteInserted).toBe(true)
  })

  it('✅ actualiza lote existente (UPDATE bot_lotes) si codigoLote ya está registrado', async () => {
    let loteUpdated = false

    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async (sql: string, params?: unknown[]) => {
      if (sql.includes('UPDATE') && sql.includes('bot_lotes')) {
        loteUpdated = true
      }
      return originalQuery(sql, params)
    }

    seedCompraOK(20, true)

    await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(loteUpdated).toBe(true)
  })

  it('✅ permite compra de producto sin lote ni vencimiento cuando no los requiere', async () => {
    let loteTouched = false
    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async (sql: string, params?: unknown[]) => {
      if (/FROM bot_lotes|INSERT INTO bot_lotes|UPDATE bot_lotes/.test(sql)) loteTouched = true
      return originalQuery(sql, params)
    }

    mockClient.responses.push(
      { rows: [{ table_name: 'bot_almacenes' }, { table_name: 'bot_locales' }, { table_name: 'bot_movimientos_almacen' }] },
      {
        rows: [
          { table_name: 'bot_compras', column_name: 'ctipo_comprobante' },
          { table_name: 'bot_compras', column_name: 'nalmacen_id' },
          { table_name: 'bot_lotes', column_name: 'nalmacen_id' },
          { table_name: 'bot_kardex', column_name: 'nalmacen_id' },
        ],
      },
      {
        rows: [{
          nid: 1,
          cnombre: 'Bolsa plastica',
          lrequiere_lote: false,
          lrequiere_vencimiento: false,
        }],
      },
      { rows: [{ cnombre: 'Distribuidora Farma SAC' }] },
      { rows: [{ nid: 1, cnombre: 'Disponible Principal', ctipo_almacen: 'DISPONIBLE' }] },
      { rows: [{ nid: 5 }] },
      { rows: [{ today: '20260411' }] },
      { rows: [{ seq: '1' }] },
      { rows: [{ nid: 50 }] },
      { rows: [] },
      { rows: [{ nstock: 20 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ...BASE_BODY,
        items: [{ ...BASE_ITEM, codigoLote: '', fechaVencimiento: '' }],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(loteTouched).toBe(false)
  })

  it('❌ rechaza compra contado sin caja abierta antes de crear compra', async () => {
    seedCompraOK(20, false, false)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({
      error: 'NO_HAY_CAJA_ABIERTA',
      message: 'Debe abrir caja para registrar compras al contado',
    })
    expect(mockClient.queries.some((query) => query.sql.includes('INSERT INTO bot_compras'))).toBe(false)
    expect(mockClient.queries.some((query) => query.sql.includes('INSERT INTO bot_compras_det'))).toBe(false)
    expect(mockClient.queries.some((query) => query.sql.includes('INSERT INTO bot_kardex'))).toBe(false)
    expect(mockClient.queries.some((query) => query.sql.includes('UPDATE bot_productos'))).toBe(false)
  })

  it('✅ permite compra crédito sin caja abierta y crea CXP', async () => {
    let cxpInserted = false
    const originalQuery = mockClient.query.bind(mockClient)
    mockClient.query = async (sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO bot_cuentas_por_pagar')) {
        cxpInserted = true
      }
      return originalQuery(sql, params)
    }

    mockClient.responses.push(
      { rows: [{ table_name: 'bot_almacenes' }, { table_name: 'bot_locales' }, { table_name: 'bot_movimientos_almacen' }] },
      {
        rows: [
          { table_name: 'bot_compras', column_name: 'ctipo_comprobante' },
          { table_name: 'bot_compras', column_name: 'nalmacen_id' },
          { table_name: 'bot_lotes', column_name: 'nalmacen_id' },
          { table_name: 'bot_kardex', column_name: 'nalmacen_id' },
        ],
      },
      {
        rows: [{
          nid: 1,
          cnombre: 'Paracetamol 500mg',
          lrequiere_lote: true,
          lrequiere_vencimiento: true,
        }],
      },
      { rows: [{ cnombre: 'Distribuidora Farma SAC' }] },
      { rows: [{ nid: 1, cnombre: 'Disponible Principal', ctipo_almacen: 'DISPONIBLE' }] },
      { rows: [{ today: '20260411' }] },
      { rows: [{ seq: '1' }] },
      { rows: [{ nid: 50 }] },
      { rows: [] },
      { rows: [{ nstock: 20 }] },
      { rows: [] },
      { rows: [] },
      { rows: [{ nid: 99 }] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        ...BASE_BODY,
        tipoPago: 'CREDITO',
        fechaVencimientoFactura: '2026-05-31',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(cxpInserted).toBe(true)
    expect(mockClient.queries.some((query) => query.sql.includes('FROM bot_caja'))).toBe(false)
  })

  it('❌ rechaza sin autenticación', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(401)
  })

  it('❌ rechaza compra sin proveedor', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, proveedorId: 0 },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Debe seleccionar un proveedor')
  })

  it('❌ rechaza compra sin tipo de comprobante', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, tipoComprobante: '' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('El tipo de comprobante es obligatorio')
  })

  it('❌ rechaza comprobante distinto de FACTURA', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, tipoComprobante: 'BOLETA' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('En esta fase solo se permite FACTURA')
  })

  it('❌ rechaza compra sin número de comprobante', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, numeroDocumento: '   ' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Debe ingresar el número de comprobante')
  })

  it('❌ rechaza compra a crédito sin fecha de vencimiento', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, tipoPago: 'CREDITO', fechaVencimientoFactura: '' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('La fecha de vencimiento de factura es obligatoria para compras a credito')
  })

  it('❌ rechaza proveedor inexistente', async () => {
    mockClient.responses.push(
      { rows: [{ table_name: 'bot_almacenes' }, { table_name: 'bot_locales' }, { table_name: 'bot_movimientos_almacen' }] },
      {
        rows: [
          { table_name: 'bot_compras', column_name: 'ctipo_comprobante' },
          { table_name: 'bot_compras', column_name: 'nalmacen_id' },
          { table_name: 'bot_lotes', column_name: 'nalmacen_id' },
          { table_name: 'bot_kardex', column_name: 'nalmacen_id' },
        ],
      },
      { rows: [{ nid: 1, cnombre: 'Paracetamol 500mg' }] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Proveedor no encontrado')
  })

  it('❌ rechaza compra sin almacén destino', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: { ...BASE_BODY, almacenId: 0 },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Debe seleccionar un almacén destino')
  })

  it('❌ rechaza almacén inexistente o inactivo', async () => {
    mockClient.responses.push(
      { rows: [{ table_name: 'bot_almacenes' }, { table_name: 'bot_locales' }, { table_name: 'bot_movimientos_almacen' }] },
      {
        rows: [
          { table_name: 'bot_compras', column_name: 'ctipo_comprobante' },
          { table_name: 'bot_compras', column_name: 'nalmacen_id' },
          { table_name: 'bot_lotes', column_name: 'nalmacen_id' },
          { table_name: 'bot_kardex', column_name: 'nalmacen_id' },
        ],
      },
      { rows: [{ nid: 1, cnombre: 'Paracetamol 500mg' }] },
      { rows: [{ cnombre: 'Distribuidora Farma SAC' }] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Almacén destino no encontrado o inactivo')
  })

  it('❌ devuelve error claro si faltan migraciones de compras', async () => {
    mockClient.responses.push(
      { rows: [{ table_name: 'bot_almacenes' }, { table_name: 'bot_locales' }, { table_name: 'bot_movimientos_almacen' }] },
      { rows: [{ table_name: 'bot_lotes', column_name: 'nalmacen_id' }, { table_name: 'bot_kardex', column_name: 'nalmacen_id' }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(503)
    expect(res.json().error).toBe('PURCHASE_SCHEMA_OUTDATED')
    expect(res.json().message).toContain('011_compras_tipo_comprobante_factura.sql')
    expect(res.json().message).toContain('012_compras_almacen_destino.sql')
  })

  it('❌ rechaza producto inexistente antes de llegar al INSERT', async () => {
    mockClient.responses.push(
      { rows: [{ table_name: 'bot_almacenes' }, { table_name: 'bot_locales' }, { table_name: 'bot_movimientos_almacen' }] },
      {
        rows: [
          { table_name: 'bot_compras', column_name: 'ctipo_comprobante' },
          { table_name: 'bot_compras', column_name: 'nalmacen_id' },
          { table_name: 'bot_lotes', column_name: 'nalmacen_id' },
          { table_name: 'bot_kardex', column_name: 'nalmacen_id' },
        ],
      },
      { rows: [] },
      { rows: [{ cnombre: 'Distribuidora Farma SAC' }] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/compras',
      headers: { Authorization: `Bearer ${token}` },
      payload: BASE_BODY,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('Producto 1 no encontrado o inactivo')
  })
})

describe('GET /api/v1/compras', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(purchasesRoutes, { prefix: '/compras' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('lista compras aunque falten columnas nuevas en bot_compras', async () => {
    mockClient.responses.push(
      { rows: [{ table_name: 'bot_almacenes' }, { table_name: 'bot_locales' }, { table_name: 'bot_movimientos_almacen' }] },
      { rows: [{ table_name: 'bot_lotes', column_name: 'nalmacen_id' }, { table_name: 'bot_kardex', column_name: 'nalmacen_id' }] },
      {
        rows: [
          {
            nid: 5,
            ccodigo: 'CMP-20260411-0005',
            nproveedor_id: 3,
            nalmacen_id: null,
            cproveedor: 'Andes Salud EIRL',
            ctipo_comprobante: 'FACTURA',
            cdocumento: '',
            ntotal: '0.00',
            cestado: 'A',
            tcreado: '2026-04-11T10:00:00.000Z',
            almacen_nombre: null,
            almacen_tipo: null,
            local_nombre: null,
          },
        ],
      },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/compras',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      {
        nid: 5,
        ccodigo: 'CMP-20260411-0005',
        nproveedor_id: 3,
        nalmacen_id: null,
        cproveedor: 'Andes Salud EIRL',
        ctipo_comprobante: 'FACTURA',
        cdocumento: '',
        ntotal: '0.00',
        cestado: 'A',
        tcreado: '2026-04-11T10:00:00.000Z',
        almacen_nombre: null,
        almacen_tipo: null,
        local_nombre: null,
      },
    ])
  })
})
