import { Navigate, createBrowserRouter } from 'react-router-dom'
import {
  PanelIndexRoute,
  RequireAuth,
  RequireSection,
} from '@/app/access-guards'
import { AppShell } from '@/components/layout/app-shell'
import { DashboardPage } from '@/pages/dashboard-page'
import { InventoryPage } from '@/pages/inventory-page'
import { LoginPage } from '@/pages/login-page'
import { PatientsPage } from '@/pages/patients-page'
import { ProceduresPage } from '@/pages/procedures-page'
import { SalesPage } from '@/pages/sales-page'
import { CajaPage } from '@/pages/caja-page'
import { ComprasPage } from '@/pages/compras-page'
import { ProveedoresPage } from '@/pages/proveedores-page'
import { MedicosPage } from '@/pages/medicos-page'
import { ReportesPage } from '@/pages/reportes-page'
import { TransferenciasPage } from '@/pages/transferencias-page'
import { AlquileresPage } from '@/pages/alquileres-page'
import { DeudoresPage } from '@/pages/deudores-page'
import { CxpPage } from '@/pages/cxp-page'
import { InventarioVarPage } from '@/pages/inventario-var-page'
import { AuditoriaPage } from '@/pages/auditoria-page'
import { UsuariosPage } from '@/pages/usuarios-page'
import { PerfilPage } from '@/pages/perfil-page'
import { LocalesPage } from '@/pages/locales-page'
import { AlmacenesPage } from '@/pages/almacenes-page'
import { TrasladosAlmacenPage } from '@/pages/traslados-almacen-page'
import { DevolucionesPage } from '@/pages/devoluciones-page'
import { ConsistenciaPage } from '@/pages/consistencia-page'
import { AlertasPage } from '@/pages/alertas-page'
import { EmailAuthCallbackPage } from '@/pages/email-auth-callback-page'
import { ClerkLoginPage } from '@/pages/clerk-login-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LoginPage />,
  },
  {
    path: '/panel',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <PanelIndexRoute />,
      },
      {
        path: 'inventario',
        element: (
          <RequireSection section="inventario">
            <InventoryPage />
          </RequireSection>
        ),
      },
      {
        path: 'ventas',
        element: (
          <RequireSection section="ventas">
            <SalesPage />
          </RequireSection>
        ),
      },
      {
        path: 'caja',
        element: (
          <RequireSection section="caja">
            <CajaPage />
          </RequireSection>
        ),
      },
      {
        path: 'compras',
        element: (
          <RequireSection section="compras">
            <ComprasPage />
          </RequireSection>
        ),
      },
      {
        path: 'proveedores',
        element: (
          <RequireSection section="proveedores">
            <ProveedoresPage />
          </RequireSection>
        ),
      },
      {
        path: 'pacientes',
        element: (
          <RequireSection section="pacientes">
            <PatientsPage />
          </RequireSection>
        ),
      },
      {
        path: 'procedimientos',
        element: (
          <RequireSection section="procedimientos">
            <ProceduresPage />
          </RequireSection>
        ),
      },
      {
        path: 'medicos',
        element: (
          <RequireSection section="medicos">
            <MedicosPage />
          </RequireSection>
        ),
      },
      {
        path: 'reportes',
        element: (
          <RequireSection section="reportes">
            <ReportesPage />
          </RequireSection>
        ),
      },
      {
        path: 'transferencias',
        element: (
          <RequireSection section="transferencias">
            <TransferenciasPage />
          </RequireSection>
        ),
      },
      {
        path: 'alquileres',
        element: (
          <RequireSection section="alquileres">
            <AlquileresPage />
          </RequireSection>
        ),
      },
      {
        path: 'deudores',
        element: (
          <RequireSection section="deudores">
            <DeudoresPage />
          </RequireSection>
        ),
      },
      {
        path: 'cuentas-por-pagar',
        element: (
          <RequireSection section="compras">
            <CxpPage />
          </RequireSection>
        ),
      },
      {
        path: 'inventario-var',
        element: (
          <RequireSection section="inventario-var">
            <InventarioVarPage />
          </RequireSection>
        ),
      },
      {
        path: 'auditoria',
        element: (
          <RequireSection section="auditoria">
            <AuditoriaPage />
          </RequireSection>
        ),
      },
      {
        path: 'usuarios',
        element: (
          <RequireSection section="usuarios">
            <UsuariosPage />
          </RequireSection>
        ),
      },
      {
        path: 'perfil',
        element: (
          <RequireSection section="perfil">
            <PerfilPage />
          </RequireSection>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <RequireSection section="dashboard">
            <DashboardPage />
          </RequireSection>
        ),
      },
      {
        path: 'locales',
        element: (
          <RequireSection section="locales">
            <LocalesPage />
          </RequireSection>
        ),
      },
      {
        path: 'almacenes',
        element: (
          <RequireSection section="almacenes">
            <AlmacenesPage />
          </RequireSection>
        ),
      },
      {
        path: 'traslados-almacen',
        element: (
          <RequireSection section="traslados-almacen">
            <TrasladosAlmacenPage />
          </RequireSection>
        ),
      },
      {
        path: 'devoluciones',
        element: (
          <RequireSection section="devoluciones">
            <DevolucionesPage />
          </RequireSection>
        ),
      },
      {
        path: 'consistencia',
        element: (
          <RequireSection section="consistencia">
            <ConsistenciaPage />
          </RequireSection>
        ),
      },
      {
        path: 'alertas',
        element: (
          <RequireSection section="alertas">
            <AlertasPage />
          </RequireSection>
        ),
      },
    ],
  },
  {
    path: '/auth/clerk',
    element: <EmailAuthCallbackPage />,
  },
  {
    path: '/login/clerk',
    element: <ClerkLoginPage />,
  },
  {
    path: '*',
    element: <Navigate replace to="/" />,
  },
])
