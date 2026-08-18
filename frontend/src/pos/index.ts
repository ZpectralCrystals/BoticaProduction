// POS principal
export { SalesPOS } from './components/SalesPOS'

// Componentes individuales
export { Cart } from './components/Cart'
export { PaymentPanel } from './components/PaymentPanel'
export { CheckoutModal } from './components/CheckoutModal'
export { ProductSearch } from './components/ProductSearch'

// Hook de estado
export { usePOS } from './hooks/usePOS'

// Utils
export {
  formatNumber,
  formatDate,
  diasHastaVencimiento,
  getVencimientoColorClass,
  getVencimientoText,
  calcularVuelto,
  debounce,
  generarIdUnico,
  calcularTotales,
} from './utils/posUtils'

// Types
export type { CartItem, MetodoPago, ItemAlerta } from './types'
