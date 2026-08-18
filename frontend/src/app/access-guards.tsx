import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import type { AppSection } from '@/lib/app-sections'
import { DashboardPage } from '@/pages/dashboard-page'

interface RequireSectionProps extends PropsWithChildren {
  section: AppSection
}

export function RequireAuth({ children }: PropsWithChildren) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted">Verificando sesion...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate replace state={{ from: location.pathname }} to="/" />
  }

  return <>{children}</>
}

export function RequireSection({ children, section }: RequireSectionProps) {
  const { canAccessSection, defaultPath, user } = useAuth()

  if (!user) {
    return <Navigate replace to="/" />
  }

  if (!canAccessSection(section)) {
    return <Navigate replace to={defaultPath} />
  }

  return <>{children}</>
}

export function PanelIndexRoute() {
  const { canAccessSection, defaultPath, user } = useAuth()

  if (!user) {
    return <Navigate replace to="/" />
  }

  if (canAccessSection('dashboard')) {
    return <DashboardPage />
  }

  return <Navigate replace to={defaultPath} />
}
