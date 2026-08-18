import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'
import { AppErrorBoundary } from '@/components/shared/app-error-boundary'
import { AppProviders } from '@/lib/providers'

function App() {
  return (
    <AppErrorBoundary>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </AppErrorBoundary>
  )
}

export default App
