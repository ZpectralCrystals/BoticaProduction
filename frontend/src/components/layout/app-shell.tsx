import { useState } from 'react'
import {
  Activity,
  Banknote,
  BarChart3,
  Box,
  ClipboardPlus,
  CircleUser,
  Contact,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  Menu,
  Package,
  Pill,
  Stethoscope,
  Truck,
  UserCog,
  Users,
  Warehouse,
  X,
  ArrowRightLeft,
  RotateCcw,
  ShieldCheck as ShieldCheckIcon,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { SessionIndicator } from '@/components/shared/auth-cta'
import { BrandLogo } from '@/components/shared/brand-logo'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/context/auth-context'
import type { AppSection } from '@/lib/app-sections'
import { cn } from '@/lib/utils'

const navigationItems = [
  { section: 'dashboard' as AppSection, to: '/panel', label: 'Dashboard', hint: 'Operacion del dia', icon: LayoutDashboard },
  { section: 'inventario' as AppSection, to: '/panel/inventario', label: 'Inventario', hint: 'Stock y vencimientos', icon: Pill },
  { section: 'ventas' as AppSection, to: '/panel/ventas', label: 'Ventas', hint: 'Cobros y detalle', icon: Activity },
  { section: 'caja' as AppSection, to: '/panel/caja', label: 'Caja', hint: 'Apertura y cierre', icon: CreditCard },
  { section: 'compras' as AppSection, to: '/panel/compras', label: 'Compras', hint: 'Proveedores y pedidos', icon: Package },
  { section: 'compras' as AppSection, to: '/panel/cuentas-por-pagar', label: 'Cuentas por pagar', hint: 'Facturas a proveedores', icon: Banknote },
  { section: 'proveedores' as AppSection, to: '/panel/proveedores', label: 'Proveedores', hint: 'Directorio y contactos', icon: Contact },
  { section: 'pacientes' as AppSection, to: '/panel/pacientes', label: 'Pacientes', hint: 'Padron medico', icon: Users },
  { section: 'procedimientos' as AppSection, to: '/panel/procedimientos', label: 'Procedimientos', hint: 'Agenda clinica', icon: ClipboardPlus },
  { section: 'medicos' as AppSection, to: '/panel/medicos', label: 'Medicos', hint: 'Registro y servicios', icon: Stethoscope },
  { section: 'reportes' as AppSection, to: '/panel/reportes', label: 'Reportes', hint: 'Ganancias y analisis', icon: BarChart3 },
  { section: 'transferencias' as AppSection, to: '/panel/transferencias', label: 'Transferencias', hint: 'Movimientos de stock', icon: Truck },
  { section: 'alquileres' as AppSection, to: '/panel/alquileres', label: 'Alquileres', hint: 'Consultorios y espacios', icon: Home },
  { section: 'deudores' as AppSection, to: '/panel/deudores', label: 'Deudores', hint: 'Cuentas por cobrar', icon: Banknote },
  { section: 'inventario-var' as AppSection, to: '/panel/inventario-var', label: 'Inv. Variado', hint: 'Activos diversos', icon: Box },
  { section: 'auditoria' as AppSection, to: '/panel/auditoria', label: 'Auditoria', hint: 'Registro de acciones', icon: FileText },
  { section: 'usuarios' as AppSection, to: '/panel/usuarios', label: 'Usuarios', hint: 'Gestion de accesos', icon: UserCog },
  { section: 'locales' as AppSection, to: '/panel/locales', label: 'Locales', hint: 'Sedes y sucursales', icon: Home },
  { section: 'almacenes' as AppSection, to: '/panel/almacenes', label: 'Almacenes', hint: 'Stock por almacén', icon: Warehouse },
  { section: 'traslados-almacen' as AppSection, to: '/panel/traslados-almacen', label: 'Traslados', hint: 'Mover stock entre almacenes', icon: ArrowRightLeft },
  { section: 'devoluciones' as AppSection, to: '/panel/devoluciones', label: 'Devoluciones', hint: 'Cliente y proveedor', icon: RotateCcw },
  { section: 'consistencia' as AppSection, to: '/panel/consistencia', label: 'Consistencia', hint: 'Integridad del stock', icon: ShieldCheckIcon },
  { section: 'alertas' as AppSection, to: '/panel/alertas', label: 'Alertas', hint: 'Vencimientos y riesgos', icon: Bell },
  { section: 'perfil' as AppSection, to: '/panel/perfil', label: 'Mi Perfil', hint: 'Datos y contraseña', icon: CircleUser },
]

const navigationGroups = [
  {
    title: 'Operacion',
    items: navigationItems.filter((item) =>
      ['dashboard', 'inventario', 'ventas', 'caja'].includes(item.section),
    ),
  },
  {
    title: 'Comercial',
    items: navigationItems.filter((item) =>
      ['compras', 'proveedores', 'deudores', 'reportes'].includes(item.section),
    ),
  },
  {
    title: 'Clinica',
    items: navigationItems.filter((item) =>
      ['pacientes', 'procedimientos', 'medicos', 'alquileres'].includes(item.section),
    ),
  },
  {
    title: 'Inventario avanzado',
    items: navigationItems.filter((item) =>
      ['transferencias', 'inventario-var', 'almacenes', 'traslados-almacen', 'devoluciones', 'consistencia', 'alertas'].includes(item.section),
    ),
  },
  {
    title: 'Administracion',
    items: navigationItems.filter((item) =>
      ['usuarios', 'locales', 'auditoria', 'perfil'].includes(item.section),
    ),
  },
]

const pageMeta: Record<string, { title: string; detail: string }> = {
  '/panel': { title: 'Vista general', detail: 'Seguimiento inicial de caja e inventario.' },
  '/panel/inventario': { title: 'Inventario', detail: 'Control de stock minimo, rotacion y vencimientos.' },
  '/panel/ventas': { title: 'Ventas', detail: 'Registro de cobros con detalle de productos y servicios.' },
  '/panel/caja': { title: 'Caja', detail: 'Apertura, cierre y estado de caja.' },
  '/panel/compras': { title: 'Compras', detail: 'Pedidos a proveedores con ingreso de stock.' },
  '/panel/cuentas-por-pagar': { title: 'Cuentas por pagar', detail: 'Facturas a proveedores y aplicación de pagos.' },
  '/panel/proveedores': { title: 'Proveedores', detail: 'Directorio de proveedores, contactos y notas.' },
  '/panel/pacientes': { title: 'Pacientes', detail: 'Padron, historial clinico y recetas.' },
  '/panel/procedimientos': { title: 'Procedimientos', detail: 'Agenda medica de procedimientos y atenciones.' },
  '/panel/medicos': { title: 'Medicos y Servicios', detail: 'Registro de medicos y catalogo de servicios.' },
  '/panel/reportes': { title: 'Reportes', detail: 'Vencimiento, ganancias, perdidas y rotacion.' },
  '/panel/transferencias': { title: 'Transferencias', detail: 'Movimientos de stock entre tiendas y donaciones.' },
  '/panel/alquileres': { title: 'Alquileres', detail: 'Consultorios y espacios en alquiler.' },
  '/panel/deudores': { title: 'Deudores', detail: 'Cuentas por cobrar y abonos.' },
  '/panel/inventario-var': { title: 'Inventario Variado', detail: 'Activos diversos: camillas, equipos, etc.' },
  '/panel/auditoria': { title: 'Auditoria', detail: 'Trazabilidad de acciones del sistema.' },
  '/panel/usuarios': { title: 'Usuarios', detail: 'Crear, editar permisos y gestionar accesos.' },
  '/panel/perfil': { title: 'Mi Perfil', detail: 'Editar datos personales y cambiar contraseña.' },
  '/panel/dashboard': {
    title: 'Vista general',
    detail: 'Seguimiento inicial de caja, inventario y operacion.',
  },
  '/panel/locales': { title: 'Locales', detail: 'Sedes y sucursales del negocio.' },
  '/panel/almacenes': { title: 'Almacenes', detail: 'Almacenes por local con políticas sanitarias.' },
  '/panel/traslados-almacen': { title: 'Traslados', detail: 'Mover stock entre almacenes con control de lotes.' },
  '/panel/devoluciones': { title: 'Devoluciones', detail: 'Devoluciones de cliente y a proveedor.' },
  '/panel/consistencia': { title: 'Consistencia', detail: 'Verificación de integridad del stock y reconciliación.' },
  '/panel/alertas': { title: 'Alertas', detail: 'Lotes por vencer, cuarentena, baja y stock fantasma.' },
}

function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggleCollapsed,
}: {
  collapsed?: boolean
  onNavigate?: () => void
  onToggleCollapsed?: () => void
}) {
  const { canAccessSection, roleDefinition, user, signOut } = useAuth()
  const navigate = useNavigate()
  const visibleNavigationItems = navigationItems.filter((item) =>
    canAccessSection(item.section),
  )

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-2 pb-4">
        <Link
          className={cn(
            'flex min-h-16 items-center justify-center transition-all',
            collapsed && 'min-h-14',
          )}
          to="/"
          title="Botica El Pueblo"
        >
          <BrandLogo imgClassName={cn('h-16 w-auto transition-all', collapsed && 'h-10')} />
        </Link>
        {onToggleCollapsed ? (
          <div className={cn('mt-3 flex', collapsed ? 'justify-center' : 'justify-end')}>
            <Button
              aria-label={collapsed ? 'Mostrar menu' : 'Ocultar menu'}
              className="rounded-lg border border-primary/20 bg-primary/10 text-primary-strong hover:bg-primary hover:text-white"
              size="icon"
              title={collapsed ? 'Mostrar menu' : 'Ocultar menu'}
              variant="ghost"
              onClick={onToggleCollapsed}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <nav className={cn('mt-4 flex-1 overflow-y-auto', collapsed ? 'px-0' : 'px-1')}>
        {navigationGroups.map((group) => {
          const groupItems = group.items.filter((item) => visibleNavigationItems.includes(item))

          if (groupItems.length === 0) return null

          return (
            <div key={group.title} className="mb-4">
              {!collapsed ? (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {group.title}
                </p>
              ) : null}
              <div className="grid gap-1">
                {groupItems.map((item) => {
                  const Icon = item.icon

                  return (
                    <NavLink
                      end={item.to === '/panel'}
                      key={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex h-11 items-center rounded-lg border border-transparent text-sm font-medium text-muted transition hover:bg-primary/10 hover:text-primary-strong',
                          collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                          isActive &&
                            'border-primary bg-primary text-white shadow-sm hover:bg-primary hover:text-white',
                        )
                      }
                      onClick={onNavigate}
                      to={item.to}
                      title={collapsed ? `${item.label} - ${item.hint}` : undefined}
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={cn(
                              'h-5 w-5 shrink-0 text-primary-strong',
                              isActive && 'text-white',
                            )}
                          />
                          {!collapsed ? (
                            <span className={cn('truncate', isActive && 'text-white')}>{item.label}</span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <Card className={cn('mt-3 shrink-0 rounded-lg p-4 shadow-none', collapsed && 'p-2')}>
        <div className={cn(collapsed && 'sr-only')}>
          <p className="text-sm font-semibold text-foreground">{user?.nombre}</p>
          <p className="mt-1 text-sm text-muted">
            DNI: {user?.dni} | {roleDefinition?.label}
          </p>
        </div>
        <Button
          aria-label="Cerrar sesion"
          className={cn('mt-4 w-full', collapsed && 'mt-0')}
          size={collapsed ? 'icon' : 'default'}
          title={collapsed ? `Cerrar sesion - ${user?.nombre ?? 'usuario'}` : undefined}
          variant="outline"
          onClick={async () => {
            await signOut()
            onNavigate?.()
            navigate('/')
          }}
        >
          {collapsed ? <CircleUser className="h-5 w-5" /> : 'Cerrar sesion'}
        </Button>
      </Card>
    </div>
  )
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('botica-sidebar-collapsed') === 'true'
  })
  const { pathname } = useLocation()
  const currentPage = pageMeta[pathname] ?? pageMeta['/panel']
  const currentDate = new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date())
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('botica-sidebar-collapsed', String(next))
      return next
    })
  }

  return (
    <div className="min-h-screen w-full max-w-none px-3 py-3 sm:px-4 lg:h-screen lg:overflow-hidden lg:px-0 lg:py-0">
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex w-full max-w-none min-w-0 gap-4 lg:h-full lg:gap-0">
        <aside
          className={cn(
            'hidden h-screen shrink-0 border-r border-border bg-white p-3 transition-[width] duration-300 lg:block',
            sidebarCollapsed ? 'w-20' : 'w-64',
          )}
        >
          <SidebarContent
            collapsed={sidebarCollapsed}
            onToggleCollapsed={toggleSidebarCollapsed}
          />
        </aside>

        <aside
          className={cn(
            'fixed inset-y-3 left-3 z-50 w-[min(85vw,20rem)] rounded-xl border border-border bg-white p-4 shadow-lg transition lg:hidden',
            mobileOpen ? 'translate-x-0' : '-translate-x-[115%]',
          )}
        >
          <div className="mb-3 flex justify-end">
            <Button size="icon" variant="ghost" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </aside>

        <main className="min-w-0 flex-1 lg:h-screen lg:overflow-y-auto">
          <header className="sticky top-0 z-30 border-b border-border bg-white px-4 py-4 shadow-sm sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <Button
                  className="lg:hidden"
                  size="icon"
                  variant="secondary"
                  onClick={() => setMobileOpen(true)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="space-y-1">
                  <p className="text-lg font-semibold text-foreground">
                    {currentPage.title}
                  </p>
                  <p className="text-sm text-muted">{currentPage.detail}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-lg border border-border bg-white px-4 py-2 text-sm text-muted">
                  {currentDate}
                </div>
                <SessionIndicator />
              </div>
            </div>
          </header>

          <section className="w-full min-w-0 p-4 sm:p-6">
            <Outlet />
          </section>
        </main>
      </div>
    </div>
  )
}
