import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { apiCargaInicialInventario } from '@/lib/api'
import { IngresoInventarioInicialPage } from './ingreso-inventario-inicial-page'

vi.mock('@/context/auth-context', () => ({ useAuth: () => ({ isAdmin: true, isSuper: false }) }))
vi.mock('@/lib/api', () => ({ apiCargaInicialInventario: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function enterCsv(csv: string) {
  render(<MemoryRouter><IngresoInventarioInicialPage /></MemoryRouter>)
  fireEvent.change(screen.getByRole('textbox', { name: 'CSV' }), { target: { value: csv } })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiCargaInicialInventario).mockResolvedValue({ ok: true, total: 1, created: [] })
})
afterEach(cleanup)

describe('Ingreso inicial de inventario', () => {
  it('permite omitir columnas opcionales sin romper la pantalla', async () => {
    enterCsv('codigo;nombre;stock;costo;precioVenta1;lote;vencimiento\nREG-1;Producto prueba;3;0.10;0.50;L1;2028-12-31')
    expect(screen.getByText('Producto prueba')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ingreso inicial' }))
    await waitFor(() => expect(apiCargaInicialInventario).toHaveBeenCalledWith([
      expect.objectContaining({ codigo: 'REG-1', stock: 3, stockMin: 0, precioVenta1: 0.5, precioVenta2: null, precioVenta3: null }),
    ]))
  })

  it('acepta tabla de Excel con tabuladores y coma decimal', async () => {
    enterCsv('codigo\tnombre\tstock\tcosto\tprecioVenta1\tlote\tvencimiento\nREG-2\tProducto Excel\t4\t0,10\t1,50\tL2\t2028-12-31')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ingreso inicial' }))
    await waitFor(() => expect(apiCargaInicialInventario).toHaveBeenCalledWith([
      expect.objectContaining({ codigo: 'REG-2', nombre: 'Producto Excel', stock: 4, costo: 0.1, precioVenta1: 1.5 }),
    ]))
  })

  it('conserva CSV separado por comas y nombres entre comillas', async () => {
    enterCsv('codigo,nombre,stock,precioVenta1,lote,vencimiento\nREG-3,"Producto, caja ""grande""",2,1.50,L3,2028-12-31')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ingreso inicial' }))
    await waitFor(() => expect(apiCargaInicialInventario).toHaveBeenCalledWith([
      expect.objectContaining({ nombre: 'Producto, caja "grande"', stock: 2, precioVenta1: 1.5 }),
    ]))
  })

  it('bloquea stock inválido antes de convertirlo en null al enviar JSON', () => {
    enterCsv('nombre;stock;precioVenta1\nProducto prueba;abc;0.50')
    expect(screen.getByText(/Fila 2: stock/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar ingreso inicial' })).toBeDisabled()
    expect(apiCargaInicialInventario).not.toHaveBeenCalled()
  })

  it('explica encabezados faltantes en lugar de fallar al editar', () => {
    enterCsv('nombre;stock\nProducto prueba;2')
    expect(screen.getByText(/Falta columna obligatoria: precioVenta1/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar ingreso inicial' })).toBeDisabled()
  })

  it('rechaza filas desplazadas por separadores adicionales', () => {
    enterCsv('nombre;stock;precioVenta1\nProducto prueba;2;0.50;dato extra')
    expect(screen.getByText(/Fila 2: cantidad de columnas/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar ingreso inicial' })).toBeDisabled()
  })

  it('muestra errores del servidor y permite corregir el archivo', async () => {
    vi.mocked(apiCargaInicialInventario).mockRejectedValue(Object.assign(new Error('ARCHIVO CON ERRORES'), {
      errors: [{ row: 2, message: 'Fila 2: codigo ya existe (REG-1)' }],
    }))
    enterCsv('codigo;nombre;stock;precioVenta1\nREG-1;Producto prueba;0;0.50')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ingreso inicial' }))
    expect(await screen.findByText('Fila 2: codigo ya existe (REG-1)')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'CSV' }), { target: { value: 'codigo;nombre;stock;precioVenta1\nREG-2;Producto prueba;0;0.50' } })
    expect(screen.queryByText('Fila 2: codigo ya existe (REG-1)')).not.toBeInTheDocument()
  })
})
