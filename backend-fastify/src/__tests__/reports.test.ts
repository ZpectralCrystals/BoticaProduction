import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import reportsRoutes from '../routes/reports.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
  TEST_USER,
} from './helpers/buildTestApp.js'

describe('GET /api/v1/reportes utilidad-ventas', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(reportsRoutes, { prefix: '/reportes' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('incluye ventas con lote, multi-lote y sin lote en utilidad', async () => {
    mockClient.responses.push({
      rows: [
        {
          venta_id: 10,
          venta_codigo: 'VTA-20260511-0001',
          venta_fecha: '2026-05-11 10:00:00',
          cliente: 'Consumidor final',
          metodo_pago: 'Efectivo',
          total_venta: '100.00',
          producto_id: 5,
          producto_codigo: 'P001',
          producto_nombre: 'Paracetamol',
          lote_id: 7,
          lote_codigo: 'L-001',
          fecha_vencimiento: '2027-01-01',
          cantidad: '2',
          precio_unitario: '50.00',
          ingreso_linea: '100.00',
          costo_unitario: '20.00',
          costo_linea: '40.00',
          utilidad_linea: '60.00',
          costo_fuente: 'LOTE',
          costo_incompleto: false,
        },
        {
          venta_id: 11,
          venta_codigo: 'VTA-20260511-0002',
          venta_fecha: '2026-05-11 11:00:00',
          cliente: 'Cliente multi lote',
          metodo_pago: 'Efectivo',
          total_venta: '90.00',
          producto_id: 6,
          producto_codigo: 'P002',
          producto_nombre: 'Ibuprofeno',
          lote_id: 8,
          lote_codigo: 'L-OLD',
          fecha_vencimiento: '2026-12-01',
          cantidad: '1',
          precio_unitario: '30.00',
          ingreso_linea: '30.00',
          costo_unitario: '10.00',
          costo_linea: '10.00',
          utilidad_linea: '20.00',
          costo_fuente: 'LOTE',
          costo_incompleto: false,
        },
        {
          venta_id: 11,
          venta_codigo: 'VTA-20260511-0002',
          venta_fecha: '2026-05-11 11:00:00',
          cliente: 'Cliente multi lote',
          metodo_pago: 'Efectivo',
          total_venta: '90.00',
          producto_id: 6,
          producto_codigo: 'P002',
          producto_nombre: 'Ibuprofeno',
          lote_id: 9,
          lote_codigo: 'L-NEW',
          fecha_vencimiento: '2027-02-01',
          cantidad: '2',
          precio_unitario: '30.00',
          ingreso_linea: '60.00',
          costo_unitario: '12.00',
          costo_linea: '24.00',
          utilidad_linea: '36.00',
          costo_fuente: 'LOTE',
          costo_incompleto: false,
        },
        {
          venta_id: 12,
          venta_codigo: 'VTA-20260511-0003',
          venta_fecha: '2026-05-11 12:00:00',
          cliente: 'Consumidor final',
          metodo_pago: 'Yape',
          total_venta: '20.00',
          producto_id: 7,
          producto_codigo: 'P003',
          producto_nombre: 'Bolsa plastica',
          lote_id: null,
          lote_codigo: null,
          fecha_vencimiento: null,
          cantidad: '4',
          precio_unitario: '5.00',
          ingreso_linea: '20.00',
          costo_unitario: '0',
          costo_linea: '0',
          utilidad_linea: '20.00',
          costo_fuente: 'SIN_LOTE',
          costo_incompleto: true,
        },
      ],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reportes?tipo=utilidad-ventas&desde=2026-05-01&hasta=2026-05-11',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockClient.queries[0].sql).toContain('FROM bot_ventas_det')
    expect(mockClient.queries[0].sql).toContain('bot_kardex')
    expect(mockClient.queries[0].sql).toContain('l.nprecio_compra')
    expect(mockClient.queries[0].params).toEqual(['2026-05-01', '2026-05-11'])
    expect(res.json().resumen).toMatchObject({
      ventasCantidad: 3,
      lineasCantidad: 4,
      ingresoTotal: 210,
      costoTotal: 74,
      utilidadTotal: 136,
      lineasSinCosto: 1,
    })
    expect(res.json().lineas[0]).toMatchObject({
      ventaCodigo: 'VTA-20260511-0001',
      productoNombre: 'Paracetamol',
      loteCodigo: 'L-001',
      cantidad: 2,
      costoFuente: 'LOTE',
      costoIncompleto: false,
    })
    expect(res.json().ventas.find((venta: { ventaId: string }) => venta.ventaId === '11')).toMatchObject({
      ingresoReconstruido: 90,
      costoTotal: 34,
      utilidad: 56,
    })
    expect(res.json().lineas.find((linea: { ventaCodigo: string }) => linea.ventaCodigo === 'VTA-20260511-0003')).toMatchObject({
      productoNombre: 'Bolsa plastica',
      loteId: null,
      loteCodigo: null,
      ingreso: 20,
      costo: 0,
      utilidad: 20,
      costoFuente: 'SIN_LOTE',
      costoIncompleto: true,
    })
  })

  it('filtra ventas anuladas desde SQL de utilidad', async () => {
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reportes?tipo=utilidad-ventas&desde=2026-05-01&hasta=2026-05-11',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(mockClient.queries[0].sql).toContain("v.cestado = 'A'")
    expect(res.json().resumen).toMatchObject({
      ventasCantidad: 0,
      lineasCantidad: 0,
      ingresoTotal: 0,
      costoTotal: 0,
      utilidadTotal: 0,
    })
  })

  it('rechaza rango de fechas invalido', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reportes?tipo=utilidad-ventas&desde=2026/05/01&hasta=2026-05-11',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('RANGO DE FECHAS INVALIDO')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('rechaza reportes financieros si usuario solo tiene reportes_ver', async () => {
    token = makeTestToken(app, { ...TEST_USER, id: 2, super: false, admin: false, permisos: ['reportes_ver'] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reportes?tipo=utilidad-ventas&desde=2026-05-01&hasta=2026-05-11',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('No tienes permiso para realizar esta acción.')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('permite reportes financieros con reportes_financieros', async () => {
    token = makeTestToken(app, { ...TEST_USER, id: 3, super: false, admin: false, permisos: ['reportes_financieros'] })
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reportes?tipo=utilidad-ventas&desde=2026-05-01&hasta=2026-05-11',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().tipo).toBe('utilidad-ventas')
    expect(mockClient.queries[0].sql).toContain('bot_kardex')
  })
})

describe('GET /api/v1/reportes permisos generales', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(reportsRoutes, { prefix: '/reportes' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  it('rechaza reporte no financiero sin permiso reportes_ver', async () => {
    const token = makeTestToken(app, { ...TEST_USER, id: 4, super: false, admin: false, permisos: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reportes?tipo=faltantes',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().message).toBe('No tienes permiso para realizar esta acción.')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('permite reporte no financiero con reportes_ver', async () => {
    const token = makeTestToken(app, { ...TEST_USER, id: 5, super: false, admin: false, permisos: ['reportes_ver'] })
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/reportes?tipo=faltantes',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ tipo: 'faltantes', total: 0, items: [] })
    expect(mockClient.queries[0].sql).toContain('FROM bot_productos')
  })
})
