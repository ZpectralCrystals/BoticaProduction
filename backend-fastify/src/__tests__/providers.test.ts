import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import providersRoutes from '../routes/providers.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
} from './helpers/buildTestApp.js'

describe('POST /api/v1/proveedores', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(providersRoutes, { prefix: '/proveedores' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('rejects required fields when missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/proveedores',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nombre: 'Proveedor incompleto',
        ruc: '',
        contacto: '',
        telefono: '',
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('RUC, razón social, teléfono y contacto son obligatorios')
  })

  it('rejects ruc when it does not have 11 digits', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/proveedores',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nombre: 'Distribuidora Prueba SAC',
        ruc: '2012345678',
        contacto: 'María López',
        telefono: '999888777',
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('El RUC debe tener exactamente 11 dígitos')
  })

  it('rejects duplicated ruc on create', async () => {
    mockClient.responses.push({ rows: [{ nid: 10 }] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/proveedores',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nombre: 'Distribuidora Farma SAC',
        ruc: '20100070970',
        contacto: 'Ana Torres',
        telefono: '999888777',
      },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().message).toBe('Ya existe un proveedor registrado con ese RUC')
  })

  it('creates provider with complete required data', async () => {
    mockClient.responses.push({ rows: [] })
    mockClient.responses.push({ rows: [{ nid: 25 }] })

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/proveedores',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nombre: 'Distribuidora Farma SAC',
        ruc: '20100070970',
        contacto: 'Ana Torres',
        telefono: '999888777',
        email: 'ventas@farma.pe',
        direccion: 'Av. Industrial 123',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, id: '25' })
  })

  it('rejects invalid provider state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/proveedores',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        nombre: 'Distribuidora Farma SAC',
        ruc: '20100070970',
        contacto: 'Ana Torres',
        telefono: '999888777',
        estado: 'BORRADO',
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('El estado del proveedor debe ser ACTIVO o INACTIVO')
  })

  it('rejects editing a provider if required fields are left incomplete', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/proveedores',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        id: 25,
        nombre: 'Distribuidora Farma SAC',
        ruc: '20100070970',
        contacto: '',
        telefono: '999888777',
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('RUC, razón social, teléfono y contacto son obligatorios')
  })

  it('lists inactive providers only when includeInactive is requested', async () => {
    mockClient.responses.push({
      rows: [
        {
          nid: 25,
          cruc: '20100070970',
          cnombre: 'Proveedor Inactivo SAC',
          ccontacto: 'Ana Torres',
          ctelefono: '999888777',
          cemail: 'ventas@farma.pe',
          cdireccion: 'Av. Industrial 123',
          cnotas: '',
          cestado: 'I',
          tcreado: '2026-04-12T10:00:00.000Z',
        },
      ],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/proveedores?includeInactive=1',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveLength(1)
    expect(res.json()[0].cestado).toBe('I')
  })
})
