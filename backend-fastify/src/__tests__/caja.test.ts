import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import cajaRoutes from '../routes/caja.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
  TEST_USER,
} from './helpers/buildTestApp.js'

describe('Caja admin/cajero y anulación de movimientos', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let adminToken: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(cajaRoutes, { prefix: '/caja' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    adminToken = makeTestToken(app, TEST_USER)
  })

  afterEach(async () => {
    await app.close()
  })

  const cajero = {
    ...TEST_USER,
    id: 2,
    nombre: 'Cajero Asignado',
    super: false,
    admin: false,
    permisos: ['caja', 'ventas'],
  }

  it('abre caja solo como admin y la asigna al usuario indicado', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 2, cnombre: 'Cajero Asignado' }] },
      { rows: [] },
      { rows: [{ nid: 10 }] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { action: 'abrir', montoApertura: 100, caja: 'Caja mostrador', usuarioId: 2 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      ok: true,
      id: '10',
      usuarioId: '2',
      usuarioNombre: 'Cajero Asignado',
    })
    expect(mockClient.queries[2].sql).toContain('INSERT INTO bot_caja')
    expect(mockClient.queries[2].params).toEqual(['Caja mostrador', 100, 2])
  })

  it('exige usuario asignado al abrir caja', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { action: 'abrir', montoApertura: 100, caja: 'Caja mostrador' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('USUARIO ASIGNADO OBLIGATORIO')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('rechaza asignar caja a usuario inactivo o inexistente', async () => {
    mockClient.responses.push({ rows: [] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { action: 'abrir', montoApertura: 100, caja: 'Caja mostrador', usuarioId: 2 },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('USUARIO ASIGNADO NO ENCONTRADO')
    expect(mockClient.queries).toHaveLength(1)
    expect(mockClient.queries[0].sql).toContain("cestado = 'A'")
    expect(mockClient.queries[0].params).toEqual([2])
  })

  it('devuelve mi caja asignada separada de cajas administrables', async () => {
    mockClient.responses.push(
      {
        rows: [{
          nid: 11,
          ccaja: 'Caja admin',
          napertura: '50.00',
          tapertura: '2026-05-11 08:00:00',
          nusuario_id: 1,
          usuario_nombre: 'Test Cajero',
        }],
      },
      {
        rows: [{
          nid: 12,
          ccaja: 'Caja cajero',
          napertura: '80.00',
          tapertura: '2026-05-11 09:00:00',
          nusuario_id: 2,
          usuario_nombre: 'Cajero Asignado',
        }],
      },
      { rows: [{ total: '0', n: '0' }] },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${adminToken}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().cajaAbierta.usuarioId).toBe('1')
    expect(res.json().cajasAbiertas).toHaveLength(1)
    expect(res.json().cajasAbiertas[0].usuarioId).toBe('2')
    expect(mockClient.queries[0].sql).toContain('AND c.nusuario_id = $1')
    expect(mockClient.queries[1].sql).toContain('OR $2::BOOLEAN = TRUE')
  })

  it('rechaza apertura de caja si usuario no es admin/super', async () => {
    const token = makeTestToken(app, cajero)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${token}` },
      payload: { action: 'abrir', montoApertura: 100 },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('SOLO ADMINISTRADOR PUEDE ABRIR CAJA')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('rechaza cierre de caja si cajero no tiene permiso explicito', async () => {
    const token = makeTestToken(app, cajero)

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${token}` },
      payload: { action: 'cerrar', cajaId: 20 },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('NO TIENE PERMISO PARA CERRAR CAJA')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('rechaza cierre de caja aunque cajero tenga permiso caja_cierre', async () => {
    const token = makeTestToken(app, { ...cajero, permisos: ['caja', 'ventas', 'caja_cierre'] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${token}` },
      payload: { action: 'cerrar', cajaId: 20 },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('NO TIENE PERMISO PARA CERRAR CAJA')
    expect(mockClient.queries).toHaveLength(0)
  })

  it('rechaza cierre admin sin cajaId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { action: 'cerrar' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('CAJA A CERRAR OBLIGATORIA')
    expect(mockClient.queries[0].sql).toBe('BEGIN')
    expect(mockClient.queries[1].sql).toBe('ROLLBACK')
  })

  it('cierra caja de cualquier cajero como admin con cierre automatico', async () => {
    mockClient.responses.push(
      { rows: [{ nid: 20, napertura: '100.00', nusuario_id: 2 }] },
      { rows: [{ ctipo: 'INGRESO', total: '25.00' }, { ctipo: 'GASTO', total: '10.00' }] },
      { rows: [{ total: '50.00' }] },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/caja',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { action: 'cerrar', cajaId: 20 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().resumen.saldoEsperado).toBe(165)
    expect(res.json().resumen.montoCierre).toBe(165)
    expect(res.json().resumen.cierreAutomatico).toBe(true)
    expect(res.json().resumen.diferencia).toBe(0)
    expect(res.json().resumen.gastos).toBe(10)
    expect(mockClient.queries[1].sql).toContain("nid = $1")
    expect(mockClient.queries[1].params).toEqual([20])
    expect(mockClient.queries[2].sql).toContain("cestado = 'A'")
    const updateQuery = mockClient.queries.find((query) => query.sql.includes('UPDATE bot_caja'))
    expect(updateQuery?.sql).toContain('nventas_total')
    expect(updateQuery?.params).toEqual([
      165,
      50,
      25,
      0,
      0,
      10,
      165,
      0,
      1,
      'Test Cajero',
      20,
    ])
  })

  it('muestra resumen de caja asignada al cajero sin permitir cierre', async () => {
    const token = makeTestToken(app, cajero)
    mockClient.responses.push(
      { rows: [{ nid: 20, napertura: '100.00', nusuario_id: 2, usuario_nombre: 'Cajero Asignado' }] },
      { rows: [{ ctipo: 'INGRESO', total: '20.00' }, { ctipo: 'EGRESO', total: '5.00' }] },
      { rows: [{ total: '50.00' }] },
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/caja/resumen?cajaId=20',
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      abierta: true,
      cajaId: '20',
      usuarioId: '2',
      usuarioNombre: 'Cajero Asignado',
      apertura: 100,
      ventas: 50,
      ingresos: 20,
      egresos: 5,
      saldoTeorico: 165,
      saldoEsperado: 165,
    })
    expect(mockClient.queries[0].params).toEqual([20, 2, false])
  })

  it('anula movimiento de caja de forma lógica y audita motivo', async () => {
    mockClient.responses.push(
      {
        rows: [{
          nid: 33,
          ncaja_id: 20,
          ctipo: 'GASTO',
          nmonto: '12.50',
          cestado: 'A',
          nusuario_id: 2,
          caja_usuario_id: 2,
        }],
      },
      { rows: [] },
      { rows: [] },
    )

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/caja/movimientos/33/anular',
      headers: { Authorization: `Bearer ${adminToken}` },
      payload: { motivo: 'Registro duplicado' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, id: '33', estado: 'ANULADO' })
    expect(mockClient.queries[2].sql).toContain("SET cestado = 'N'")
    expect(mockClient.queries[2].sql).toContain('$2::TEXT')
    expect(mockClient.queries[2].sql).toContain('$3::TEXT')
    expect(mockClient.queries[3].params?.[3]).toContain('Registro duplicado')
  })

  it('rechaza anulación de movimiento sin permiso admin o caja_anular', async () => {
    const token = makeTestToken(app, cajero)

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/caja/movimientos/33/anular',
      headers: { Authorization: `Bearer ${token}` },
      payload: { motivo: 'Error' },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('NO TIENE PERMISO PARA ANULAR MOVIMIENTOS DE CAJA')
    expect(mockClient.queries).toHaveLength(0)
  })
})
