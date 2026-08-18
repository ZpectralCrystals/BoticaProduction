import { LogOut } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/auth-context'
import { useAuthBridge } from '@/context/auth-bridge'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import { Button } from '@/components/ui/button'

export function AuthCallToAction() {
  const navigate = useNavigate()
  const { defaultPath, user, roleDefinition } = useAuth()
  const { signOutAll } = useAuthBridge()

  return (
    <div className="flex flex-wrap gap-3">
      {user ? (
        <Link className={buttonVariants({ size: 'lg' })} to={defaultPath}>
          Continuar como {roleDefinition?.label}
        </Link>
      ) : (
        <a className={buttonVariants({ size: 'lg' })} href="#login">
          Iniciar sesion
        </a>
      )}
      {user ? (
        <Button
          size="lg"
          variant="outline"
          onClick={async () => {
            await signOutAll()
            navigate('/')
          }}
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </Button>
      ) : null}
    </div>
  )
}

export function SessionIndicator() {
  const navigate = useNavigate()
  const { user, roleDefinition } = useAuth()
  const { signOutAll } = useAuthBridge()

  return (
    <div className="flex items-center gap-2">
      <Badge variant={user ? 'success' : 'warning'}>
        {roleDefinition ? `${roleDefinition.label} | ${user?.nombre}` : 'Sin sesion'}
      </Badge>
      {user ? (
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await signOutAll()
            navigate('/')
          }}
        >
          <LogOut className="h-4 w-4" />
          Salir
        </Button>
      ) : null}
    </div>
  )
}
