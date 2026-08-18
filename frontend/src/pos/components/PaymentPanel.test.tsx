import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PaymentPanel } from './PaymentPanel'

const baseProps = {
  total: 200,
  customerMode: 'generico' as const,
  patients: [],
  selectedClinicalCustomerId: null,
  metodoPago: 'Mixto' as const,
  montoEfectivo: 50,
  montoDigital: 0,
  onCustomerModeChange: vi.fn(),
  onPatientSelect: vi.fn(),
  onMetodoPagoChange: vi.fn(),
  onMontoEfectivoChange: vi.fn(),
  onMontoDigitalChange: vi.fn(),
  clienteDocumento: '99999999',
  onClienteDocumentoChange: vi.fn(),
  clienteNombre: 'Consumidor final',
  onClienteNombreChange: vi.fn(),
}

describe('PaymentPanel — pago mixto automático', () => {
  it('calcula digital pendiente cuando efectivo no cubre total', () => {
    const onMontoDigitalChange = vi.fn()

    render(
      <PaymentPanel
        {...baseProps}
        showCustomerSection={false}
        onMontoDigitalChange={onMontoDigitalChange}
      />,
    )

    expect(onMontoDigitalChange).toHaveBeenCalledWith(150)
    expect(screen.getByText(/Falta pagar:/)).toBeInTheDocument()
  })

  it('deja digital en 0 y muestra vuelto si efectivo supera total', () => {
    const onMontoDigitalChange = vi.fn()

    render(
      <PaymentPanel
        {...baseProps}
        showCustomerSection={false}
        montoEfectivo={250}
        montoDigital={0}
        onMontoDigitalChange={onMontoDigitalChange}
      />,
    )

    expect(onMontoDigitalChange).not.toHaveBeenCalled()
    expect(screen.getByText('Vuelto')).toBeInTheDocument()
    expect(screen.getByText('S/ 50.00')).toBeInTheDocument()
  })

  it('mantiene digital pendiente como campo automático en método mixto', async () => {
    const user = userEvent.setup()

    render(
      <PaymentPanel
        {...baseProps}
        showCustomerSection={false}
        montoDigital={150}
      />,
    )

    const digitalInput = screen.getByLabelText(/Digital pendiente/i)
    expect(digitalInput).toHaveAttribute('readonly')

    await user.click(digitalInput)
    expect(digitalInput).toHaveValue(150)
  })
})
