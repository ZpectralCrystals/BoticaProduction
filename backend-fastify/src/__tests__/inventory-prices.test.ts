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

describe('GET /api/v1/inventario catalogo completo', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildApp(mockClient)
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('no oculta productos posteriores al número 50 en el listado general', async () => {
    mockClient.responses.push({ rows: Array.from({ length: 60 }, (_, i) => ({
      nid: i + 1, ccodigo: `REG-${i + 1}`, cnombre: `Producto ${i + 1}`, nstock: 1,
    })) })
    const response = await app.inject({ method: 'GET', url: '/api/v1/inventario', headers: { Authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toHaveLength(60)
    expect(response.json()[59]).toMatchObject({ codigo: 'REG-60', stock: 1 })
    expect(mockClient.queries[0].sql).not.toMatch(/LIMIT/i)
    expect(mockClient.queries[0].params).toEqual([])
  })

  it('conserva límite explícito y búsqueda parametrizada', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/inventario?search=REG&limit=5', headers: { Authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    expect(mockClient.queries[0].sql).toContain('LIMIT $4')
    expect(mockClient.queries[0].params).toEqual(['%REG%', '%REG%', '%REG%', 5])
  })
})

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

describe('DELETE /api/v1/inventario/:id', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildApp(mockClient)
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('retira del catalogo producto sin stock y conserva historial', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 7, ccodigo: 'MED-007', cnombre: 'Producto prueba', nstock: 0, stock_lotes: 0 }] },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
    )

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/inventario/7',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true, id: '7', deleted: true })
    const sql = mockClient.queries.map((query) => query.sql).join('\n')
    expect(sql).toContain("UPDATE bot_productos SET cestado = 'I'")
    expect(sql).toContain('UPDATE bot_producto_precios SET lactivo = FALSE')
    expect(sql).toContain('ELIMINAR_PRODUCTO')
    expect(sql).not.toContain('DELETE FROM bot_productos')
  })

  it('bloquea eliminacion si producto conserva stock', async () => {
    mockClient.responses.push({
      rows: [{ nid: 7, ccodigo: 'MED-007', cnombre: 'Producto prueba', nstock: 2, stock_lotes: 2 }],
    })

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/inventario/7',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().error).toBe('PRODUCTO TIENE STOCK')
    expect(mockClient.queries.some((query) => query.sql.includes("SET cestado = 'I'"))).toBe(false)
  })
})

describe('POST /api/v1/inventario action update', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildApp(mockClient)
    token = makeTestToken(app)
  })

  afterEach(async () => { await app.close() })

  it('mantiene código inmutable y permite editar costo, stock y controles de lote', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 3, cnombre: 'Material medico', nfamilia_id: null, familia_nombre: null }] },
      { rows: [{ nid: 7, ccodigo: 'ANT-007', nprecompra: 1, nstock: 0, nstockmin: 1, stock_lotes: 0 }] },
      { rows: [] },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [{ cnombre: 'Producto actualizado', nstock: 0 }], rowCount: 1 },
      { rows: [], rowCount: 1 },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inventario',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        action: 'update',
        id: '7',
        codigo: 'NUEVO-007',
        name: 'Producto actualizado',
        tipoProducto: 'MEDICAMENTO',
        categoryId: 3,
        generico: 'Descripción libre',
        precioCompra: 4.5,
        precioVenta1: 8,
        precioVenta2: null,
        precioVenta3: 9,
        stock: 3,
        minStock: 1,
        requiereLote: false,
        requiereVencimiento: false,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true, id: '7' })
    const sql = mockClient.queries.map((query) => query.sql).join('\n')
    expect(sql).toContain('update "bot_productos"')
    const updateProduct = mockClient.queries.find((query) => query.sql.includes('update "bot_productos"'))
    expect(updateProduct?.sql).not.toContain('"ccodigo"')
    expect(updateProduct?.params).not.toContain('NUEVO-007')
    expect(sql).toContain('"nprecompra"')
    expect(sql).toContain('"nstock"')
    expect(sql).toContain('EDITAR_PRODUCTO')
    expect(updateProduct?.params).toContain(false)
  })

  it('aumenta stock con lote y registra Kárdex y entrada de almacén', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 3, cnombre: 'Medicamentos', nfamilia_id: null, familia_nombre: null }] },
      { rows: [{ nid: 7, ccodigo: 'MED-007', nprecompra: 1, nstock: 10, nstockmin: 1, lrequiere_lote: true }] },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [{ cnombre: 'Producto con lote', nstock: 10 }], rowCount: 1 },
      { rows: [{ nid: 101, nalmacen_id: 2, ccodigo_lote: 'LOT-1', ncantidad: 10 }], rowCount: 1 },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inventario',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        action: 'update', id: '7', name: 'Producto con lote', tipoProducto: 'MEDICAMENTO',
        categoryId: 3, precioCompra: 1, precioVenta1: 2, stock: 15, minStock: 1,
        requiereLote: true, requiereVencimiento: true,
      },
    })

    expect(response.statusCode).toBe(200)
    const lotUpdate = mockClient.queries.find((query) => query.sql.includes('UPDATE bot_lotes'))
    expect(lotUpdate?.params).toEqual([15, 101])
    const kardex = mockClient.queries.find((query) => query.sql.includes('INSERT INTO bot_kardex'))
    expect(kardex?.params?.slice(0, 7)).toEqual([7, 101, 'LOT-1', 2, 5, 10, 15])
    const movement = mockClient.queries.find((query) => query.sql.includes('INSERT INTO bot_movimientos_almacen'))
    expect(movement?.params?.slice(0, 6)).toEqual([7, 101, null, 2, 'AJUSTE_ENTRADA', 5])
    expect(mockClient.queries.some((query) => query.sql.trim() === 'COMMIT')).toBe(true)
  })

  it('reduce stock con lote y registra Kárdex y salida de almacén', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 3, cnombre: 'Medicamentos', nfamilia_id: null, familia_nombre: null }] },
      { rows: [{ nid: 7, ccodigo: 'MED-007', nprecompra: 1, nstock: 15, nstockmin: 1, lrequiere_lote: true }] },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [], rowCount: 1 },
      { rows: [{ cnombre: 'Producto con lote', nstock: 15 }], rowCount: 1 },
      { rows: [{ nid: 101, nalmacen_id: 2, ccodigo_lote: 'LOT-1', ncantidad: 15 }], rowCount: 1 },
    )

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/inventario',
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        action: 'update', id: '7', name: 'Producto con lote', tipoProducto: 'MEDICAMENTO',
        categoryId: 3, precioCompra: 1, precioVenta1: 2, stock: 10, minStock: 1,
        requiereLote: true, requiereVencimiento: true,
      },
    })

    expect(response.statusCode).toBe(200)
    const lotUpdate = mockClient.queries.find((query) => query.sql.includes('UPDATE bot_lotes'))
    expect(lotUpdate?.params).toEqual([10, 101])
    const kardex = mockClient.queries.find((query) => query.sql.includes('INSERT INTO bot_kardex'))
    expect(kardex?.params?.slice(0, 7)).toEqual([7, 101, 'LOT-1', 2, -5, 15, 10])
    const movement = mockClient.queries.find((query) => query.sql.includes('INSERT INTO bot_movimientos_almacen'))
    expect(movement?.params?.slice(0, 6)).toEqual([7, 101, 2, null, 'AJUSTE_SALIDA', 5])
    expect(mockClient.queries.some((query) => query.sql.trim() === 'COMMIT')).toBe(true)
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

  it('permite composición pendiente para medicamento', async () => {
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
    expect(res.json().error).toBe('CATEGORIA NO ENCONTRADA')
  })

  it('permite precio cero pendiente para producto no medicamento', async () => {
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
    expect(res.json().error).toBe('CATEGORIA NO ENCONTRADA')
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
