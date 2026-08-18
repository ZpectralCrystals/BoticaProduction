import { useCallback, useEffect, useMemo, useState } from 'react'
import { 
  Banknote, 
  Smartphone, 
  ArrowRightLeft,
  Calculator,
  User,
  Users
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CustomerMode, MetodoPago, PosPatientOption } from '../types'
import { formatCurrency } from '@/lib/utils'
import { calcularVuelto } from '../utils/posUtils'

interface PaymentPanelProps {
  total: number
  customerMode: CustomerMode
  patients: PosPatientOption[]
  selectedClinicalCustomerId: number | null
  showCustomerSection?: boolean
  showPaymentSection?: boolean
  metodoPago: MetodoPago
  montoEfectivo: number
  montoDigital: number
  onCustomerModeChange: (mode: CustomerMode) => void
  onPatientSelect: (patientId: number) => void
  onMetodoPagoChange: (metodo: MetodoPago) => void
  onMontoEfectivoChange: (monto: number) => void
  onMontoDigitalChange: (monto: number) => void
  clienteDocumento: string
  onClienteDocumentoChange: (documento: string) => void
  clienteNombre: string
  onClienteNombreChange: (nombre: string) => void
}

const METODOS_PAGO: Array<{ id: MetodoPago; label: string; icon: LucideIcon }> = [
  { id: 'Efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'Yape', label: 'Yape', icon: Smartphone },
  { id: 'Mixto', label: 'Mixto', icon: ArrowRightLeft },
]

const QUICK_AMOUNTS = [10, 20, 50, 100, 200]
const CALCULATOR_ROWS = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+'],
]

export function PaymentPanel({
  total,
  customerMode,
  patients,
  selectedClinicalCustomerId,
  showCustomerSection = true,
  showPaymentSection = true,
  metodoPago,
  montoEfectivo,
  montoDigital,
  onCustomerModeChange,
  onPatientSelect,
  onMetodoPagoChange,
  onMontoEfectivoChange,
  onMontoDigitalChange,
  clienteDocumento,
  onClienteDocumentoChange,
  clienteNombre,
  onClienteNombreChange,
}: PaymentPanelProps) {
  const [showCalculator, setShowCalculator] = useState(false)
  const [calculatorInput, setCalculatorInput] = useState('')
  const [patientSearch, setPatientSearch] = useState('')

  const vuelto = calcularVuelto(total, montoEfectivo, montoDigital)
  const totalPagado = montoEfectivo + montoDigital
  const faltante = Math.max(0, total - totalPagado)
  const montoDigitalAutomatico = Math.max(0, Math.round((total - montoEfectivo) * 100) / 100)

  const filteredPatients = useMemo(() => {
    const search = patientSearch.trim().toLowerCase()
    if (!search) return patients.slice(0, 12)

    return patients
      .filter((patient) => {
        const fullName = patient.fullName.toLowerCase()
        const documentId = patient.documentId.toLowerCase()
        return fullName.includes(search) || documentId.includes(search)
      })
      .slice(0, 12)
  }, [patientSearch, patients])

  useEffect(() => {
    if (metodoPago === 'Efectivo') {
      onMontoDigitalChange(0)
      if (montoEfectivo === 0) {
        onMontoEfectivoChange(Math.ceil(total / 10) * 10)
      }
    } else if (metodoPago === 'Yape') {
      onMontoEfectivoChange(0)
      onMontoDigitalChange(total)
    }
  }, [metodoPago, total, montoEfectivo, onMontoDigitalChange, onMontoEfectivoChange])

  useEffect(() => {
    if (metodoPago !== 'Mixto') return
    if (montoDigital !== montoDigitalAutomatico) {
      onMontoDigitalChange(montoDigitalAutomatico)
    }
  }, [metodoPago, montoDigital, montoDigitalAutomatico, onMontoDigitalChange])

  useEffect(() => {
    if (customerMode !== 'clinica') {
      setPatientSearch('')
      return
    }

    const selectedPatient = patients.find((patient) => patient.id === selectedClinicalCustomerId)
    if (selectedPatient) {
      setPatientSearch(`${selectedPatient.fullName} · ${selectedPatient.documentId}`)
    }
  }, [customerMode, patients, selectedClinicalCustomerId])

  const handleCalculatorKey = useCallback((key: string) => {
    if (key === 'C') {
      setCalculatorInput('')
    } else if (key === '=') {
      try {
        if (!/^[\d\s+\-*/.()]+$/.test(calculatorInput)) throw new Error('invalid')
        const result = Function('"use strict"; return (' + calculatorInput + ')')()
        setCalculatorInput(isFinite(result) ? String(Math.round(result * 100) / 100) : '')
      } catch {
        setCalculatorInput('')
      }
    } else if (key === '←') {
      setCalculatorInput(prev => prev.slice(0, -1))
    } else {
      setCalculatorInput(prev => prev + key)
    }
  }, [calculatorInput])

  const handleMetodoPagoClick = useCallback((id: MetodoPago) => {
    onMetodoPagoChange(id)
  }, [onMetodoPagoChange])

  const handleEfectivoChange = useCallback((value: string) => {
    onMontoEfectivoChange(parseFloat(value) || 0)
  }, [onMontoEfectivoChange])

  const handleDigitalChange = useCallback((value: string) => {
    onMontoDigitalChange(parseFloat(value) || 0)
  }, [onMontoDigitalChange])

  const toggleCalculator = useCallback(() => {
    setShowCalculator((current) => !current)
  }, [])

  return (
    <div className="bg-surface rounded-xl border border-border p-6 space-y-6">
      {showCustomerSection && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <User className="h-4 w-4" />
            Cliente
          </label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={() => onCustomerModeChange('generico')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                customerMode === 'generico'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <User className="h-4 w-4" />
              Cliente genérico
            </button>
            <button
              onClick={() => onCustomerModeChange('clinica')}
              className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                customerMode === 'clinica'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <Users className="h-4 w-4" />
              Cliente de clínica
            </button>
          </div>

          {customerMode === 'clinica' ? (
            <div className="space-y-2">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Buscar cliente de clínica por DNI o nombre"
                className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <div className="max-h-48 overflow-auto rounded-lg border border-border bg-surface">
                {filteredPatients.length > 0 ? (
                  filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        onPatientSelect(patient.id)
                        setPatientSearch(`${patient.fullName} · ${patient.documentId}`)
                      }}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                        selectedClinicalCustomerId === patient.id
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <span className="font-medium">{patient.fullName}</span>
                      <span className="text-sm text-muted">DNI {patient.documentId}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-muted">
                    No se encontraron clientes de clínica con ese DNI o nombre.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => onClienteNombreChange(e.target.value)}
                placeholder="Consumidor final"
                className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <input
                type="text"
                value={clienteDocumento}
                onChange={(e) => onClienteDocumentoChange(e.target.value)}
                placeholder="Documento opcional"
                className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          )}
        </div>
      )}

      {showPaymentSection && (
        <>
          <div>
            <label className="text-sm font-medium text-foreground mb-3 block">
              Método de pago
            </label>
            <div className="grid grid-cols-5 gap-2">
              {METODOS_PAGO.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleMetodoPagoClick(id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                    metodoPago === id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50 hover:bg-accent'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {(metodoPago === 'Efectivo' || metodoPago === 'Mixto') && (
              <div>
                <label className="flex items-center justify-between text-sm font-medium text-foreground mb-2">
                  <span className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Efectivo
                  </span>
                  <span className="text-xs text-muted">F8 para focus</span>
                </label>
                <input
                  type="number"
                  value={montoEfectivo || ''}
                  onChange={(e) => handleEfectivoChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-foreground text-lg font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <div className="flex gap-2 mt-2">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => onMontoEfectivoChange(amount)}
                      className="px-3 py-1 text-sm bg-muted/50 hover:bg-muted rounded-md transition-colors"
                    >
                      +{amount}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(metodoPago === 'Yape' || metodoPago === 'Mixto') && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Smartphone className="h-4 w-4" />
                  {metodoPago === 'Yape' ? 'Yape' : 'Digital pendiente'}
                </label>
                <input
                  type="number"
                  aria-label={metodoPago === 'Yape' ? 'Yape' : 'Digital pendiente'}
                  value={montoDigital || ''}
                  onChange={(e) => handleDigitalChange(e.target.value)}
                  placeholder="0.00"
                  readOnly={metodoPago === 'Mixto'}
                  className="w-full px-4 py-3 border border-border rounded-lg bg-surface text-foreground text-lg font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary read-only:bg-muted/30"
                />
                {metodoPago === 'Mixto' && (
                  <p className="mt-1 text-xs text-muted">
                    Se completa automáticamente con el saldo pendiente.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total a pagar</span>
              <span className="font-medium">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Entregado</span>
              <span className="font-medium">{formatCurrency(totalPagado)}</span>
            </div>
            
            {faltante > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Faltante</span>
                <span className="font-bold">{formatCurrency(faltante)}</span>
              </div>
            )}
            
            {vuelto > 0 && (
              <div className="flex justify-between text-lg font-bold text-green-600 pt-2 border-t border-border">
                <span>Vuelto</span>
                <span>{formatCurrency(vuelto)}</span>
              </div>
            )}
          </div>

          <div>
            <button
              onClick={toggleCalculator}
              className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              <Calculator className="h-4 w-4" />
              {showCalculator ? 'Ocultar' : 'Mostrar'} calculadora
            </button>
            
            {showCalculator && (
              <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                <input
                  type="text"
                  value={calculatorInput}
                  readOnly
                  className="w-full px-3 py-2 mb-2 text-right font-mono text-lg bg-surface border border-border rounded"
                />
                <div className="grid grid-cols-4 gap-1">
                  {CALCULATOR_ROWS.flat().map(k => (
                    <button key={k} onClick={() => handleCalculatorKey(k)} className="p-2 bg-surface hover:bg-accent rounded text-center font-medium">{k}</button>
                  ))}
                  <button onClick={() => handleCalculatorKey('C')} className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded text-center font-medium col-span-2">C</button>
                  <button onClick={() => handleCalculatorKey('←')} className="p-2 bg-surface hover:bg-accent rounded text-center font-medium col-span-2">←</button>
                </div>
              </div>
            )}
          </div>

          <div className={`p-3 rounded-lg text-center font-medium ${
            faltante > 0 
              ? 'bg-amber-100 text-amber-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {faltante > 0 
              ? `Falta pagar: ${formatCurrency(faltante)}`
              : 'Pago completo ✓'
            }
          </div>
        </>
      )}
    </div>
  )
}
