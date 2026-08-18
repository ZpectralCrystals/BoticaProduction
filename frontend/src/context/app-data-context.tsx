import { useCallback, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type {
  AppointmentRecord,
  InventoryItem,
  PatientRecord,
  PaymentMethod,
  ReportAlert,
  SaleRecord,
} from '@/data/types'
import {
  AppDataContext,
  type AppDataContextValue,
} from '@/context/app-data'
import {
  apiAddAppointment,
  apiAddPatient,
  apiAddProduct,
  apiAddSale,
  apiGetAppointments,
  apiGetDashboard,
  apiGetInventory,
  apiGetPatients,
  apiGetSales,
} from '@/lib/api'
import { useAuth } from '@/context/auth-context'

export function AppDataProvider({ children }: PropsWithChildren) {
  const { user } = useAuth()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [patients, setPatients] = useState<PatientRecord[]>([])
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([])
  const [alerts, setAlerts] = useState<ReportAlert[]>([])
  const [metrics, setMetrics] = useState<AppDataContextValue['metrics']>({
    totalProducts: 0,
    lowStock: 0,
    expiringSoon: 0,
    todayRevenue: 0,
    todaySalesCount: 0,
    todayAppointments: 0,
    totalPatients: 0,
    doctors: 0,
  })
  const [cashBreakdown, setCashBreakdown] = useState<AppDataContextValue['cashBreakdown']>({
    yape: 0,
    efectivo: 0,
    mixto: 0,
  })

  const loadAll = useCallback(async () => {
    if (!user) return
    try {
      const [inv, sal, pat, apt, dash] = await Promise.allSettled([
        apiGetInventory(),
        apiGetSales(),
        apiGetPatients(),
        apiGetAppointments(),
        apiGetDashboard(),
      ])
      if (inv.status === 'fulfilled') {
        setInventory(
          inv.value.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            family: i.family,
            stock: i.stock,
            minStock: i.minStock,
            expiresAt: i.expiresAt,
            location: i.location,
            supplier: i.supplier,
            rotation: i.rotation,
            unitPrice: i.precioVenta ?? 0,
          })),
        )
      }

      if (sal.status === 'fulfilled') {
        setSales(
          sal.value.map((s) => ({
            id: s.id,
            concept: s.concept,
            customer: s.customer,
            paymentMethod: s.paymentMethod as PaymentMethod,
            total: s.total,
            cashier: s.cashier,
            area: s.area,
            notes: s.notes,
            at: s.at,
          })),
        )
      }

      if (pat.status === 'fulfilled') {
        setPatients(
          pat.value.map((p) => ({
            id: p.id,
            fullName: p.fullName,
            documentId: p.documentId,
            phone: p.phone,
            age: p.age,
            notes: p.notes,
            lastVisit: p.lastVisit,
          })),
        )
      }

      if (apt.status === 'fulfilled') {
        setAppointments(
          apt.value.map((a) => ({
            id: a.id,
            patient: a.patient,
            doctor: a.doctor,
            specialty: a.specialty,
            room: a.room,
            startsAt: a.startsAt,
            status: a.status,
          })),
        )
      }

      if (dash.status === 'fulfilled') {
        setMetrics(dash.value.metrics)
        setCashBreakdown(dash.value.cashBreakdown)
        setAlerts(
          dash.value.alerts.map((a) => ({
            id: a.id,
            title: a.title,
            detail: a.detail,
            tone: a.tone as ReportAlert['tone'],
            tag: a.tag,
          })),
        )
      }
    } catch {
      // Will fail if not authenticated - that's ok
    }
  }, [user])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const value: AppDataContextValue = {
    inventory,
    sales,
    patients,
    appointments,
    alerts,
    metrics,
    cashBreakdown,
    async addInventoryItem(item) {
      await apiAddProduct(item)
      loadAll()
    },
    restockInventoryItem() {
      throw new Error('Flujo eliminado: use el módulo de Compras para ingresar stock.')
    },
    async addSale(sale) {
      await apiAddSale(sale)
      loadAll()
    },
    async addPatient(patient) {
      await apiAddPatient(patient)
      loadAll()
    },
    async scheduleAppointment(appointment) {
      await apiAddAppointment(appointment)
      loadAll()
    },
  }

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  )
}
