import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComprasPage } from './compras-page'

const {
  apiGetCompras,
  apiGetProveedores,
  apiGetInventory,
  apiGetAlmacenes,
  apiAddCompra,
} = vi.hoisted(() => ({
  apiGetCompras: vi.fn(),
  apiGetProveedores: vi.fn(),
  apiGetInventory: vi.fn(),
  apiGetAlmacenes: vi.fn(),
  apiAddCompra: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  apiGetCompras,
  apiGetProveedores,
  apiGetInventory,
  apiGetAlmacenes,
  apiAddCompra,
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const MOCK_PROVEEDOR = {
  nid: '10',
  cruc: '20100070970',
  cnombre: 'Distribuidora Farma SAC',
  ccontacto: 'Ana Torres',
  ctelefono: '999888777',
  cemail: 'ventas@farma.pe',
  cdireccion: 'Av. Industrial 123',
  cnotas: '',
  cestado: 'A',
}

const MOCK_ALMACEN = {
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
}

const MOCK_PRODUCTO = {
  id: '1',
  codigo: 'MED-001',
  name: 'Paracetamol 500mg',
  generico: 'Paracetamol',
  category: 'MEDICAMENTO',
  family: 'ANALGESICO',
  presentacion: 'TABLETA',
  laboratorio: 'LAB TEST',
  precioCompra: 2.5,
  precioVenta: 4.5,
  stock: 100,
  minStock: 10,
  location: 'Estante A',
  supplier: 'Distribuidora Farma SAC',
  supplierId: '10',
  rotation: 'Alta' as const,
  expiresAt: '2027-12-31',
  receta: 'N',
  lotes: [],
  lotePrincipal: null,
  totalLotes: 0,
}

function getSelectByLabel(label: string) {
  const select = screen.getByText(label).closest('label')?.querySelector('select')
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`No se encontró select para ${label}`)
  }
  return select
}

beforeEach(() => {
  vi.clearAllMocks()
  apiGetCompras.mockResolvedValue([])
  apiGetProveedores.mockResolvedValue([MOCK_PROVEEDOR])
  apiGetInventory.mockResolvedValue([MOCK_PRODUCTO])
  apiGetAlmacenes.mockResolvedValue([MOCK_ALMACEN])
  apiAddCompra.mockResolvedValue({ ok: true, id: '55', codigo: 'CMP-20260412-0001', total: 2.5 })
})

describe('ComprasPage', () => {
  it('carga proveedor y almacén destino, y envía proveedorId/almacenId en el submit', async () => {
    const user = userEvent.setup()
    render(<ComprasPage />)

    await waitFor(() => expect(apiGetCompras).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Nueva compra' }))

    const proveedorSelect = getSelectByLabel('Proveedor *')
    const almacenSelect = getSelectByLabel('Almacén destino *')

    expect(within(proveedorSelect).getByRole('option', { name: /Distribuidora Farma SAC · RUC 20100070970/ })).toBeInTheDocument()
    expect(within(almacenSelect).getByRole('option', { name: /Botica Central · Disponible Principal · DISPONIBLE/ })).toBeInTheDocument()

    await user.selectOptions(proveedorSelect, '10')
    await user.selectOptions(almacenSelect, '3')
    await user.type(screen.getByPlaceholderText('F001-00012345'), 'F001-00012345')
    await user.click(screen.getByRole('button', { name: 'Agregar linea' }))

    const selects = screen.getAllByRole('combobox')
    // 0: proveedor, 1: tipo comprobante, 2: almacén, 3: tipo de pago, 4+: producto
    const productoSelect = selects[4]
    await user.selectOptions(productoSelect, '1')
    await user.clear(screen.getByPlaceholderText('P.Unit'))
    await user.type(screen.getByPlaceholderText('P.Unit'), '2.5')
    await user.type(screen.getByPlaceholderText('Código de lote *'), 'LT-001')
    await user.type(screen.getByTitle('Fecha vencimiento lote *'), '2027-01-01')

    await user.click(screen.getByRole('button', { name: 'Registrar compra' }))

    await waitFor(() => {
      expect(apiAddCompra).toHaveBeenCalledWith({
        proveedorId: 10,
        almacenId: 3,
        tipoComprobante: 'FACTURA',
        numeroDocumento: 'F001-00012345',
        notas: '',
        tipoPago: 'CONTADO',
        fechaVencimientoFactura: '',
        items: [
          {
            productoId: 1,
            cantidad: 1,
            precioUnit: 2.5,
            codigoLote: 'LT-001',
            fechaVencimiento: '2027-01-01',
          },
        ],
      })
    })
  })

  it('mantiene visibles los catálogos aunque falle otra carga y muestra el error específico', async () => {
    const user = userEvent.setup()
    apiGetCompras.mockRejectedValue(new Error('Compras fuera de servicio'))

    render(<ComprasPage />)

    await screen.findByText('Incidencias de carga')
    expect(screen.getByText(/No se pudieron cargar las compras/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Nueva compra' }))

    const proveedorSelect = getSelectByLabel('Proveedor *')
    const almacenSelect = getSelectByLabel('Almacén destino *')

    expect(within(proveedorSelect).getByRole('option', { name: /Distribuidora Farma SAC/ })).toBeInTheDocument()
    expect(within(almacenSelect).getByRole('option', { name: /Botica Central · Disponible Principal · DISPONIBLE/ })).toBeInTheDocument()
  })
})
