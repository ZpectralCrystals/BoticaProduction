import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductSearch } from './ProductSearch'

const { searchProducts } = vi.hoisted(() => ({
  searchProducts: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  apiPOSBuscarProductos: searchProducts,
}))

describe('ProductSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    searchProducts.mockReset()
    searchProducts.mockImplementation((_search: string, signal?: AbortSignal) => (
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      })
    ))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('aborta búsquedas anteriores y la pendiente al desmontar', async () => {
    const view = render(<ProductSearch onProductSelect={vi.fn()} />)
    const input = screen.getByPlaceholderText('Buscar medicamento… (F2 para enfocar)')

    fireEvent.change(input, { target: { value: 'acido' } })
    await act(async () => { vi.advanceTimersByTime(300) })
    const firstSignal = searchProducts.mock.calls[0][1] as AbortSignal
    expect(firstSignal.aborted).toBe(false)

    fireEvent.change(input, { target: { value: 'paracetamol' } })
    expect(firstSignal.aborted).toBe(true)
    await act(async () => { vi.advanceTimersByTime(300) })

    const secondSignal = searchProducts.mock.calls[1][1] as AbortSignal
    expect(secondSignal.aborted).toBe(false)
    fireEvent.change(input, { target: { value: 'ibuprofeno' } })
    expect(secondSignal.aborted).toBe(true)
    await act(async () => { vi.advanceTimersByTime(300) })

    const thirdSignal = searchProducts.mock.calls[2][1] as AbortSignal
    expect(thirdSignal.aborted).toBe(false)
    view.unmount()
    expect(thirdSignal.aborted).toBe(true)
  })
})
