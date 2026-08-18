import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import providersRoutes from '../routes/providers.routes.js'
import almacenesRoutes from '../routes/almacenes.routes.js'
import {
  buildTestApp,
  createMockClient,
  makeTestToken,
} from './helpers/buildTestApp.js'

describe('Catálogos usados por compras', () => {
  let app: FastifyInstance
  let mockClient: ReturnType<typeof createMockClient>
  let token: string

  beforeEach(async () => {
    mockClient = createMockClient()
    app = await buildTestApp(mockClient)
    await app.register(
      async (instance) => {
        await instance.register(providersRoutes, { prefix: '/proveedores' })
        await instance.register(almacenesRoutes, { prefix: '/almacenes' })
      },
      { prefix: '/api/v1' },
    )
    await app.ready()
    token = makeTestToken(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('GET /api/v1/proveedores devuelve proveedores activos para compras', async () => {
    mockClient.responses.push({
      rows: [
        {
          nid: 10,
          cruc: '20100070970',
          cnombre: 'Distribuidora Farma SAC',
          ccontacto: 'Ana Torres',
          ctelefono: '999888777',
          cemail: 'ventas@farma.pe',
          cdireccion: 'Av. Industrial 123',
          cnotas: '',
          cestado: 'A',
          tcreado: '2026-04-12T10:00:00.000Z',
        },
      ],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/proveedores',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      {
        nid: 10,
        cruc: '20100070970',
        cnombre: 'Distribuidora Farma SAC',
        ccontacto: 'Ana Torres',
        ctelefono: '999888777',
        cemail: 'ventas@farma.pe',
        cdireccion: 'Av. Industrial 123',
        cnotas: '',
        cestado: 'A',
        tcreado: '2026-04-12T10:00:00.000Z',
      },
    ])
  })

  it('GET /api/v1/almacenes devuelve almacenes activos con shape usable por compras', async () => {
    mockClient.responses.push({
      rows: [
        {
          nid: 3,
          nlocal_id: 1,
          local_nombre: 'Botica Central',
          local_tipo: 'BOTICA',
          cnombre: 'Disponible Principal',
          ccodigo: 'ALM-BOT-DISP',
          ctipo_almacen: 'DISPONIBLE',
          bpermite_venta: true,
          bpermite_consumo_clinico: false,
          brequiere_revision: false,
          cestado: 'A',
          tcreado: '2026-04-12T10:00:00.000Z',
          lotes_activos: '2',
          stock_total: '50',
        },
      ],
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/almacenes',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      {
        id: 3,
        localId: 1,
        localNombre: 'Botica Central',
        localTipo: 'BOTICA',
        nombre: 'Disponible Principal',
        codigo: 'ALM-BOT-DISP',
        tipoAlmacen: 'DISPONIBLE',
        permiteVenta: true,
        permiteConsumoClinico: false,
        requiereRevision: false,
        estado: 'A',
        creado: '2026-04-12T10:00:00.000Z',
        lotesActivos: 2,
        stockTotal: 50,
      },
    ])
  })
})
