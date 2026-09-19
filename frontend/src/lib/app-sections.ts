export type AppSection =
  | 'dashboard'
  | 'inventario'
  | 'inventario-inicial'
  | 'ventas'
  | 'caja'
  | 'compras'
  | 'recepcion'
  | 'proveedores'
  | 'pacientes'
  | 'procedimientos'
  | 'medicos'
  | 'reportes'
  | 'transferencias'
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
  'inventario-inicial': '/panel/inventario-inicial',
  ventas: '/panel/ventas',
  caja: '/panel/caja',
  compras: '/panel/compras',
  recepcion: '/panel/recepcion',
  proveedores: '/panel/proveedores',
  pacientes: '/panel/pacientes',
  procedimientos: '/panel/procedimientos',
  medicos: '/panel/medicos',
  reportes: '/panel/reportes',
  transferencias: '/panel/transferencias',
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

  const entries = (Object.entries(sectionPaths) as [AppSection, string][])
    .sort((a, b) => b[1].length - a[1].length)
  for (const [section, path] of entries) {
    if (section !== 'dashboard' && pathname.startsWith(path)) {
      return section
    }
  }

  return null
}
