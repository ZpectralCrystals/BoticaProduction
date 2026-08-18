import { useState, useRef, useEffect } from 'react'
import { Search, Package, Clock, AlertTriangle, Plus, Loader2 } from 'lucide-react'
import { apiPOSBuscarProductos, type ApiPOSProduct } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { diasHastaVencimiento, getVencimientoColorClass, getVencimientoText } from '../utils/posUtils'

interface ProductSearchProps {
  onProductSelect: (product: ApiPOSProduct) => void
}

function getAvailablePrices(product: ApiPOSProduct) {
  return [
    { label: 'P1', value: product.precioVenta1 ?? product.precioVenta ?? 0 },
    { label: 'P2', value: product.precioVenta2 ?? 0 },
    { label: 'P3', value: product.precioVenta3 ?? 0 },
  ].filter((price) => Number.isFinite(price.value) && price.value > 0)
}

export function ProductSearch({ onProductSelect }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<ApiPOSProduct[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchTerm.trim().length < 2) return

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setIsLoading(true)
      setHasSearched(true)
      try {
        const res = await apiPOSBuscarProductos(searchTerm)
        if (!cancelled) setResults(res.success ? res.data : [])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchTerm])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function handleSelect(product: ApiPOSProduct) {
    if (product.stock <= 0 || getAvailablePrices(product).length === 0) return
    onProductSelect(product)
    setSearchTerm('')
    setResults([])
    setHasSearched(false)
    inputRef.current?.focus()
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        {isLoading ? (
          <Loader2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary animate-spin pointer-events-none" />
        ) : (
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted/70 pointer-events-none" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            const term = e.target.value
            setSearchTerm(term)
            if (term.trim().length < 2) {
              setResults([])
              setHasSearched(false)
              setIsLoading(false)
            }
          }}
          placeholder="Buscar medicamento… (F2 para enfocar)"
          autoComplete="off"
          className="w-full h-12 pl-12 pr-4 text-base border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        />
      </div>

      {hasSearched && (
        <div className="rounded-lg border border-border bg-surface divide-y divide-border overflow-hidden shadow-md">
          {results.length === 0 && !isLoading && (
            <div className="px-4 py-6 text-center text-sm text-muted">
              Sin resultados para <strong>"{searchTerm}"</strong>
            </div>
          )}

          {results.map((product) => {
            const dias = diasHastaVencimiento(product.expiresAt)
            const sinStock = product.stock <= 0
            const precios = getAvailablePrices(product)
            const sinPrecio = precios.length === 0

            return (
              <button
                key={product.id}
                onClick={() => handleSelect(product)}
                disabled={sinStock || sinPrecio}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  sinStock || sinPrecio ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary/5'
                }`}
              >
                <Package className="h-5 w-5 text-muted shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate">{product.nombre}</p>
                    {product.receta === 'S' && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded shrink-0">
                        Receta
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted">{product.codigo}</span>
                    {product.generico && (
                      <span className="text-xs text-muted truncate max-w-[160px]">{product.generico}</span>
                    )}
                    {dias !== null && (
                      <span
                        className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${getVencimientoColorClass(dias)}`}
                      >
                        <Clock className="h-3 w-3" />
                        {getVencimientoText(dias)}
                      </span>
                    )}
                    {sinStock && (
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Sin stock
                      </span>
                    )}
                    {sinPrecio && (
                      <span className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Sin precio
                      </span>
                    )}
                    {!sinStock && product.stock <= 5 && (
                      <span className="text-xs text-amber-600">Stock bajo: {product.stock}</span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-semibold text-primary">
                    {precios[0] ? formatCurrency(precios[0].value) : 'Sin precio'}
                  </p>
                  {precios.length > 1 && (
                    <p className="text-xs text-muted">
                      {precios.map((price) => `${price.label} ${formatCurrency(price.value)}`).join(' · ')}
                    </p>
                  )}
                  <p className="text-xs text-muted">Stock: {product.stock}</p>
                </div>

                {!sinStock && !sinPrecio && <Plus className="h-4 w-4 text-primary shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
