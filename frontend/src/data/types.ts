export type InventoryStatus = 'estable' | 'bajo' | 'vencimiento'
export type PaymentMethod = 'Yape' | 'Efectivo' | 'Mixto'
export type AppointmentStatus = 'Confirmada' | 'En espera' | 'Atendida'
export type RotationLevel = 'Alta' | 'Media' | 'Baja'
export type AlertTone = 'warning' | 'danger' | 'success' | 'info'

export interface InventoryItem {
  id: string
  name: string
  category: string
  family: string
  stock: number
  minStock: number
  expiresAt: string
  location: string
  supplier: string
  rotation: RotationLevel
  unitPrice: number
}

export interface SaleRecord {
  id: string
  concept: string
  customer: string
  paymentMethod: PaymentMethod
  total: number
  cashier: string
  area: string
  at: string
  notes: string
}

export interface PatientRecord {
  id: string
  fullName: string
  documentId: string
  phone: string
  age: number
  lastVisit: string
  notes: string
}

export interface AppointmentRecord {
  id: string
  patient: string
  doctor: string
  specialty: string
  room: string
  startsAt: string
  status: AppointmentStatus
}

export interface ReportAlert {
  id: string
  title: string
  detail: string
  tone: AlertTone
  tag: string
}
