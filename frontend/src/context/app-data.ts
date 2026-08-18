import { createContext, useContext } from 'react'
import type {
  AppointmentRecord,
  AppointmentStatus,
  InventoryItem,
  PaymentMethod,
  PatientRecord,
  ReportAlert,
  RotationLevel,
  SaleRecord,
} from '@/data/types'

export interface InventoryDraft {
  name: string
  category: string
  family: string
  stock: number
  minStock: number
  expiresAt: string
  location: string
  supplier: string
  rotation: RotationLevel
}

export interface SaleDraft {
  concept: string
  customer: string
  paymentMethod: PaymentMethod
  total: number
  cashier: string
  area: string
  notes: string
}

export interface PatientDraft {
  fullName: string
  documentId: string
  phone: string
  age: number
  notes: string
}

export interface AppointmentDraft {
  patient: string
  doctor: string
  specialty: string
  room: string
  startsAt: string
  status: AppointmentStatus
}

export interface AppDataContextValue {
  inventory: InventoryItem[]
  sales: SaleRecord[]
  patients: PatientRecord[]
  appointments: AppointmentRecord[]
  alerts: ReportAlert[]
  metrics: {
    totalProducts: number
    lowStock: number
    expiringSoon: number
    todayRevenue: number
    todaySalesCount: number
    todayAppointments: number
    totalPatients: number
    doctors: number
  }
  cashBreakdown: {
    yape: number
    efectivo: number
    mixto: number
  }
  addInventoryItem: (item: InventoryDraft) => void
  restockInventoryItem: (id: string, quantity: number) => void
  addSale: (sale: SaleDraft) => void
  addPatient: (patient: PatientDraft) => void
  scheduleAppointment: (appointment: AppointmentDraft) => void
}

export const AppDataContext = createContext<AppDataContextValue | null>(null)

export function useAppData() {
  const context = useContext(AppDataContext)

  if (!context) {
    throw new Error('useAppData debe usarse dentro de AppDataProvider')
  }

  return context
}
