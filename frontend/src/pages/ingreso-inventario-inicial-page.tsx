import { useMemo, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Navigate, useNavigate } from 'react-router-dom'
import { apiCargaInicialInventario } from '@/lib/api'
import type { ApiInitialInventoryError, ApiInitialInventoryRow } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { inputBaseClassName } from '@/components/ui/input'
import { useAuth } from '@/context/auth-context'

const templateHeaders = [
  'codigo',
  'nombre',
  'tipoProducto',
  'composicion',
  'familia',
  'categoria',
  'presentacion',
  'laboratorio',
  'stock',
  'stockMin',
  'costo',
  'precioVenta1',
  'precioVenta2',
  'precioVenta3',
  'lote',
  'vencimiento',
  'ubicacion',
  'rotacion',
  'receta',
  'requiereLote',
  'requiereVencimiento',
]

const template = `${templateHeaders.join(';')}\n750100000001;Paracetamol 500mg;MEDICAMENTO;Paracetamol 500mg;Analgesicos;Medicamentos;Caja x 100;Generico;24;5;0.10;0.50;;;L001;2027-12-31;Vitrina A1;Media;N;S;S\n`

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return { cells, quoted }
}

function parseCsv(text: string): { rows: ApiInitialInventoryRow[]; errors: ApiInitialInventoryError[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
  const errors: ApiInitialInventoryError[] = []
  if (lines.length < 2) return { rows: [], errors }
  const headerLine = lines[0]
  const delimiter = [';', ',', '\t'].sort((a, b) =>
    splitCsvLine(headerLine, b).cells.length - splitCsvLine(headerLine, a).cells.length,
  )[0]
  const headers = splitCsvLine(headerLine, delimiter).cells.map(header =>
    templateHeaders.find(name => name.toLowerCase() === header.toLowerCase()) ?? header,
  )
  for (const name of ['nombre', 'stock', 'precioVenta1']) {
    if (!headers.includes(name)) errors.push({ row: 1, message: `Falta columna obligatoria: ${name}` })
  }
  if (new Set(headers).size !== headers.length) errors.push({ row: 1, message: 'Hay encabezados repetidos' })
  if (lines.length > 301) errors.push({ row: 1, message: 'Máximo 300 productos por carga' })
  if (errors.length) return { rows: [], errors }
  const rotation = (value: string) => {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'alta') return 'Alta'
    if (normalized === 'baja') return 'Baja'
    return 'Media'
  }
  const rows = lines.slice(1).map((line, index) => {
    const rowNumber = index + 2
    const { cells, quoted } = splitCsvLine(line, delimiter)
    const addError = (message: string) => errors.push({ row: rowNumber, message: `Fila ${rowNumber}: ${message}` })
    if (quoted) addError('comillas sin cerrar; use una línea por producto')
    if (cells.length > headers.length) addError('cantidad de columnas mayor que los encabezados')
    const row: Record<string, string> = {}
    headers.forEach((header, index) => { row[header] = cells[index] || '' })
    const num = (field: string) => {
      const value = (row[field] ?? '').trim()
      if (!value) {
        if (field === 'stock' || field === 'precioVenta1') addError(`${field} obligatorio`)
        return undefined
      }
      const normalized = value.replace(',', '.')
      const number = Number(normalized)
      if (!/^\d+(?:\.\d+)?$/.test(normalized) || !Number.isFinite(number)) {
        addError(`${field} debe ser un número mayor o igual a cero, sin separador de miles`)
        return undefined
      }
      if ((field === 'stock' || field === 'stockMin') && !Number.isSafeInteger(number)) {
        addError(`${field} debe ser entero mayor o igual a cero`)
      }
      if (field === 'precioVenta1' && number <= 0) addError('precioVenta1 debe ser mayor a cero')
      return number
    }
    if (!row.nombre) addError('nombre obligatorio')
    return {
      codigo: row.codigo,
      nombre: row.nombre,
      tipoProducto: row.tipoProducto || 'MEDICAMENTO',
      composicion: row.composicion,
      familia: row.familia,
      categoria: row.categoria || 'Medicamentos',
      presentacion: row.presentacion,
      laboratorio: row.laboratorio,
      stock: num('stock') ?? 0,
      stockMin: num('stockMin') ?? 0,
      costo: num('costo') ?? 0,
      precioVenta1: num('precioVenta1') ?? 0,
      precioVenta2: num('precioVenta2') ?? null,
      precioVenta3: num('precioVenta3') ?? null,
      lote: row.lote,
      vencimiento: row.vencimiento,
      ubicacion: row.ubicacion,
      rotacion: rotation(row.rotacion || 'Media'),
      receta: row.receta || 'N',
      requiereLote: ['S', 'SI', 'TRUE', '1'].includes((row.requiereLote || '').trim().toUpperCase()),
      requiereVencimiento: ['S', 'SI', 'TRUE', '1'].includes((row.requiereVencimiento || '').trim().toUpperCase()),
    }
  })
  return { rows, errors }
}

export function IngresoInventarioInicialPage() {
  const navigate = useNavigate()
  const { isAdmin, isSuper } = useAuth()
  const [text, setText] = useState(template)
  const [errors, setErrors] = useState<ApiInitialInventoryError[]>([])
  const [saving, setSaving] = useState(false)
  const { rows, errors: parseErrors } = useMemo(() => parseCsv(text), [text])
  const visibleErrors = [...parseErrors, ...errors]
  const stockTotal = rows.reduce((sum, row) => sum + Number(row.stock || 0), 0)

  if (!isAdmin && !isSuper) return <Navigate replace to="/panel/inventario" />

  const downloadTemplate = () => {
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla-ingreso-inventario-primera-vez.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = async (file: File | null) => {
    if (!file) return
    try {
      setText(await file.text())
      setErrors([])
    } catch {
      toast.error('No se pudo leer el archivo. Vuelva a seleccionarlo.')
    }
  }

  const submit = async () => {
    if (parseErrors.length > 0) {
      toast.error('Corrija los errores del archivo antes de guardar')
      return
    }
    if (rows.length === 0) {
      toast.error('No hay filas para cargar')
      return
    }
    setSaving(true)
    setErrors([])
    try {
      const res = await apiCargaInicialInventario(rows)
      toast.success(`Ingreso inicial listo: ${res.total} productos`)
      navigate('/panel/inventario')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error en ingreso inicial')
      const maybeErrors = (e as { errors?: ApiInitialInventoryError[] })?.errors
      if (Array.isArray(maybeErrors)) setErrors(maybeErrors)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Página para instalar botica con stock existente. Use una fila por medicamento/producto. No requiere factura.
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Filas detectadas</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Stock total</p>
          <p className="text-2xl font-bold">{stockTotal}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Con lote</p>
          <p className="text-2xl font-bold">{rows.filter(row => row.lote).length}</p>
        </Card>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            Descargar plantilla
          </Button>
          <label className={inputBaseClassName + ' flex max-w-sm cursor-pointer items-center gap-2'}>
            <Upload className="h-4 w-4" />
            <span>Subir CSV</span>
            <input
              className="hidden"
              type="file"
              accept=".csv,.txt"
              disabled={saving}
              onChange={e => void handleFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <p className="text-sm text-muted">
          Pegue CSV o una tabla de Excel con encabezados. Obligatorios: nombre, stock y precioVenta1.
          Las demás columnas son opcionales; medicamentos con stock requieren lote y vencimiento (AAAA-MM-DD).
          Precios con punto o coma decimal, sin separador de miles. Máximo 300 productos por carga.
        </p>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">CSV</span>
          <textarea
            className="min-h-[260px] w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-primary"
            value={text}
            disabled={saving}
            onChange={e => { setText(e.target.value); setErrors([]) }}
          />
        </label>

        {visibleErrors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-semibold">Errores encontrados</p>
            <ul className="mt-2 max-h-36 list-disc overflow-auto pl-5">
              {visibleErrors.map((error, index) => (
                <li key={index}>{error.message}</li>
              ))}
            </ul>
          </div>
        )}

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-muted">
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">Lote</th>
                  <th className="px-3 py-2">Vencimiento</th>
                  <th className="px-3 py-2">Venta 1</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 12).map((row, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="px-3 py-2">{row.codigo || '-'}</td>
                    <td className="px-3 py-2 font-medium">{row.nombre}</td>
                    <td className="px-3 py-2">{row.stock}</td>
                    <td className="px-3 py-2">{row.lote || '-'}</td>
                    <td className="px-3 py-2">{row.vencimiento || '-'}</td>
                    <td className="px-3 py-2">S/{Number(row.precioVenta1 || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={submit} disabled={saving || rows.length === 0 || parseErrors.length > 0}>
            {saving ? 'Cargando...' : 'Guardar ingreso inicial'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/panel/inventario')}>Volver</Button>
        </div>
      </Card>
    </div>
  )
}
