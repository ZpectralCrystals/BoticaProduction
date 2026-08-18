export type AppSection =
  | 'dashboard'
  | 'inventario'
  | 'ventas'
  | 'caja'
  | 'compras'
  | 'proveedores'
  | 'pacientes'
  | 'procedimientos'
  | 'medicos'
  | 'reportes'
  | 'transferencias'
  | 'alquileres'
  | 'deudores'
  | 'inventario-var'
  | 'auditoria'
  | 'usuarios'
  | 'perfil'
  | 'locales'
  | 'almacenes'
  | 'traslados-almacen'
  | 'devoluciones'
  | 'consistencia'
  | 'alertas'

export const sectionPaths: Record<AppSection, string> = {
  dashboard: '/panel',
  inventario: '/panel/inventario',
  ventas: '/panel/ventas',
  caja: '/panel/caja',
  compras: '/panel/compras',
  proveedores: '/panel/proveedores',
  pacientes: '/panel/pacientes',
  procedimientos: '/panel/procedimientos',
  medicos: '/panel/medicos',
  reportes: '/panel/reportes',
  transferencias: '/panel/transferencias',
  alquileres: '/panel/alquileres',
  deudores: '/panel/deudores',
  'inventario-var': '/panel/inventario-var',
  auditoria: '/panel/auditoria',
  usuarios: '/panel/usuarios',
  perfil: '/panel/perfil',
  locales: '/panel/locales',
  almacenes: '/panel/almacenes',
  'traslados-almacen': '/panel/traslados-almacen',
  devoluciones: '/panel/devoluciones',
  consistencia: '/panel/consistencia',
  alertas: '/panel/alertas',
}

export function getSectionFromPath(pathname: string): AppSection | null {
  if (pathname === '/panel' || pathname === '/panel/') {
    return 'dashboard'
  }

  const entries = Object.entries(sectionPaths) as [AppSection, string][]
  for (const [section, path] of entries) {
    if (section !== 'dashboard' && pathname.startsWith(path)) {
      return section
    }
  }

  return null
}
