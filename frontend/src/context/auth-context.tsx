import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { PropsWithChildren } from 'react'
import {
  apiClerkSync,
  apiCheckSession,
  apiLogin,
  apiLogout,
  type AuthUser,
} from '@/lib/api'
import type { AppSection } from '@/lib/app-sections'
import { sectionPaths } from '@/lib/app-sections'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  role: string | null
  roleDefinition: { label: string; scope: string; defaultPath: string; allowedSections: AppSection[] } | null
  defaultPath: string
  signIn: (dni: string, clave: string) => Promise<void>
  syncClerkSession: (clerkToken: string) => Promise<AuthUser>
  signOut: () => Promise<void>
  canAccessSection: (section: AppSection) => boolean
  isSuper: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiCheckSession()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const syncClerkSession = useCallback(async (clerkToken: string) => {
    setError(null)
    setLoading(true)
    try {
      const response = await apiClerkSync(clerkToken)
      setUser(response.user)
      return response.user
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo sincronizar sesión Clerk'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const role = user?.rol ?? null
  const isSuper = user?.super ?? false
  const isAdmin = user?.admin ?? false
  const permisos = useMemo(() => user?.permisos ?? [], [user])

  // Build dynamic role definition from permisos
  const roleDefinition = user ? {
    label: user.nombre,
    scope: isSuper ? 'Super usuario' : isAdmin ? 'Administrador' : `${permisos.length} modulos`,
    defaultPath: permisos.includes('dashboard') ? '/panel' : (permisos.length > 0 ? (sectionPaths[permisos[0] as AppSection] ?? '/panel') : '/panel'),
    allowedSections: permisos as AppSection[],
  } : null

  const defaultPath = roleDefinition?.defaultPath ?? '/panel'

  const signIn = useCallback(async (dni: string, clave: string) => {
    setError(null)
    setLoading(true)
    try {
      const u = await apiLogin(dni, clave)
      setUser(u)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error de conexion'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await apiLogout()
    } catch {
      // ignore
    }
    setUser(null)
  }, [])

  const canAccessSection = useCallback(
    (section: AppSection) => {
      if (!user) return false
      // Perfil is always accessible for any logged-in user
      if (section === 'perfil') return true
      // Super and admin have access to everything including 'usuarios'
      if (isSuper || isAdmin) return true
      return permisos.includes(section)
    },
    [user, isSuper, isAdmin, permisos],
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        role,
        roleDefinition,
        defaultPath,
        signIn,
        syncClerkSession,
        signOut,
        canAccessSection,
        isSuper,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}
