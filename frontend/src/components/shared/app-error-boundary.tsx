import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocurrió un error inesperado en la aplicación.',
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AppErrorBoundary', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="max-w-xl space-y-4 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Se interrumpió la operación de la interfaz</h1>
            <p className="text-sm text-muted">
              {this.state.errorMessage || 'Recargue la página para reintentar. Si persiste, revise el backend y el navegador.'}
            </p>
          </div>
          <Button className="mx-auto" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Recargar aplicación
          </Button>
        </Card>
      </div>
    )
  }
}
