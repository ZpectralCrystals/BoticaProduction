import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ClerkProviderWrapper } from '@/lib/clerk-provider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProviderWrapper>
      <App />
    </ClerkProviderWrapper>
  </StrictMode>,
)
