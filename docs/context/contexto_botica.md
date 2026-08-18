# contexto_botica.md

Análisis completo del sistema Botica El Pueblo para migración a React + Vite + Fastify + Supabase.

---

## 1. Stack Actual

### Frontend
- **Framework**: React ^19.2.4 con TypeScript
- **Build Tool**: Vite ^8.0.4
- **Router**: react-router-dom ^7.14.0
- **Styling**: TailwindCSS ^4.2.2
- **UI Components**: Componentes personalizados basados en class-variance-authority
- **Auth**: @clerk/clerk-react ^5.61.4
- **Icons**: lucide-react ^1.7.0
- **Notifications**: sonner ^2.0.7

### Backend
- **Lenguaje**: PHP (API procedural)
- **Base de Datos**: PostgreSQL
- **Conector**: Clases personalizadas CSql, CBase (ORM propio ligero)
- **Auth**: Sesiones PHP con Clerk en frontend
- **API Style**: Endpoints REST monolíticos por módulo

### Base de Datos
- **Motor**: PostgreSQL
- **Schema**: bot_*

---

## 2. Estructura del Proyecto

```
/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── router.tsx              # Configuración de rutas
│   │   ├── components/
│   │   │   ├── ui/                     # Botones, inputs, cards, dialogs
│   │   │   └── shared/                 # PageHeader, MetricCard
│   │   ├── context/
│   │   │   └── auth-context.tsx        # Clerk auth
│   │   ├── data/
│   │   │   └── types.ts                # TypeScript types
│   │   ├── hooks/
│   │   │   └── use-mobile.tsx
│   │   ├── lib/
│   │   │   └── utils.ts
│   │   ├── pages/
│   │   │   ├── sales-page.tsx          # POS principal
│   │   │   ├── inventory-page.tsx
│   │   │   ├── dashboard-page.tsx
│   │   │   ├── usuarios-page.tsx
│   │   │   └── ... (19 páginas)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/
│   ├── Clases/
│   │   ├── CBase.php                   # Clase base con utilidades
│   │   └── CSql.php                    # Conector PostgreSQL
│   ├── migrations/
│   │   ├── 001_inicial.sql
│   │   └── 002_modulos_completos.sql   # Schema actual
│   ├── ventas.php                      # API Ventas
│   ├── inventario.php                  # API Inventario
│   ├── productos.php                   # API Productos
│   ├── index.php                       # Entry point
│   └── schema.sql                      # Dump del schema
│
├── docs/context/contexto_botica.md     # Este archivo
└── README.md
```

---

## 3. Esquema de Base de Datos (CRÍTICO)

Extraído de: `backend/migrations/002_modulos_completos.sql`

### Tablas de Productos e Inventario

#### bot_productos
```sql
CREATE TABLE bot_productos (
    nid SERIAL PRIMARY KEY,
    ccodigo VARCHAR(50) UNIQUE NOT NULL,
    cnombre VARCHAR(255) NOT NULL,
    cdescripcion TEXT,
    nstock INTEGER DEFAULT 0,
    nprecio NUMERIC(12,2) DEFAULT 0,          -- Precio de venta
    nprecio_compra NUMERIC(12,2) DEFAULT 0,  -- Precio de compra
    nlote_id INTEGER REFERENCES bot_lotes(nid),
    ncategoria_id INTEGER REFERENCES bot_categorias(nid),
    nestado INTEGER DEFAULT 1,
    nproveedor_id INTEGER REFERENCES bot_proveedores(nid),
    nusuario_id INTEGER REFERENCES bot_usuarios(nid),
    tcreado TIMESTAMP DEFAULT NOW(),
    tmodifi TIMESTAMP DEFAULT NOW()
);
```

#### bot_lotes
```sql
CREATE TABLE bot_lotes (
    nid SERIAL PRIMARY KEY,
    ccodigo VARCHAR(50) UNIQUE NOT NULL,
    cdescripcion VARCHAR(255),
    dfecha_fabricacion DATE,
    dfecha_vencimiento DATE,                  -- IMPORTANTE: Fecha de expiración
    nproducto_id INTEGER REFERENCES bot_productos(nid),
    ncantidad INTEGER DEFAULT 0,
    nestado INTEGER DEFAULT 1,
    nusuario_id INTEGER REFERENCES bot_usuarios(nid),
    tcreado TIMESTAMP DEFAULT NOW(),
    tmodifi TIMESTAMP DEFAULT NOW()
);
```

#### bot_categorias
```sql
CREATE TABLE bot_categorias (
    nid SERIAL PRIMARY KEY,
    cnombre VARCHAR(100) NOT NULL,
    cdescripcion TEXT,
    nestado INTEGER DEFAULT 1,
    tcreado TIMESTAMP DEFAULT NOW()
);
```

#### bot_proveedores
```sql
CREATE TABLE bot_proveedores (
    nid SERIAL PRIMARY KEY,
    cnombre VARCHAR(255) NOT NULL,
    cruc VARCHAR(20),
    cdireccion TEXT,
    ctelefono VARCHAR(50),
    cemail VARCHAR(100),
    nestado INTEGER DEFAULT 1,
    tcreado TIMESTAMP DEFAULT NOW()
);
```

### Tablas de Ventas

#### bot_ventas
```sql
CREATE TABLE bot_ventas (
    nid SERIAL PRIMARY KEY,
    ccodigo VARCHAR(50) UNIQUE NOT NULL,
    ccliente VARCHAR(255) DEFAULT 'Consumidor final',
    cnrodni_cli VARCHAR(20),
    cmetpago VARCHAR(50) DEFAULT 'Efectivo',  -- Efectivo, Yape, Mixto
    carea VARCHAR(50) DEFAULT 'Botica',
    ccaja VARCHAR(50) DEFAULT 'Caja principal',
    nsubtotal NUMERIC(12,2) DEFAULT 0,
    nigv NUMERIC(12,2) DEFAULT 0,
    ntotal NUMERIC(12,2) DEFAULT 0,
    cnotas TEXT,
    cestado VARCHAR(1) DEFAULT 'A',         -- A=Activa, F=Finalizada, C=Cancelada
    nusuario_id INTEGER REFERENCES bot_usuarios(nid),
    tcreado TIMESTAMP DEFAULT NOW(),
    tmodifi TIMESTAMP DEFAULT NOW()
);
```

#### bot_ventas_det (Detalle de ventas)
```sql
CREATE TABLE bot_ventas_det (
    nid SERIAL PRIMARY KEY,
    nventa_id INTEGER REFERENCES bot_ventas(nid),
    ctipo VARCHAR(50) DEFAULT 'Producto',     -- Producto o Servicio
    nproducto_id INTEGER REFERENCES bot_productos(nid),
    nservicio_id INTEGER REFERENCES bot_servicios(nid),
    ncantidad INTEGER DEFAULT 1,
    npreunit NUMERIC(12,2) DEFAULT 0,       -- Precio unitario
    nsubtotal NUMERIC(12,2) DEFAULT 0,
    cdescripcion TEXT,
    tcreado TIMESTAMP DEFAULT NOW()
);
```

#### bot_servicios
```sql
CREATE TABLE bot_servicios (
    nid SERIAL PRIMARY KEY,
    ccodigo VARCHAR(50) UNIQUE NOT NULL,
    cnombre VARCHAR(255) NOT NULL,
    cdescripcion TEXT,
    nprecio NUMERIC(12,2) DEFAULT 0,
    nestado INTEGER DEFAULT 1,
    tcreado TIMESTAMP DEFAULT NOW()
);
```

### Tablas de Auditoría y Usuarios

#### bot_usuarios
```sql
CREATE TABLE bot_usuarios (
    nid SERIAL PRIMARY KEY,
    cnombre VARCHAR(100) NOT NULL,
    cemail VARCHAR(100) UNIQUE NOT NULL,
    cpassword VARCHAR(255),
    crol VARCHAR(50) DEFAULT 'cajero',        -- admin, super, cajero, farmaceutico
    nestado INTEGER DEFAULT 1,
    tcreado TIMESTAMP DEFAULT NOW(),
    tmodifi TIMESTAMP DEFAULT NOW()
);
```

#### bot_auditoria
```sql
CREATE TABLE bot_auditoria (
    nid SERIAL PRIMARY KEY,
    nusuario_id INTEGER REFERENCES bot_usuarios(nid),
    cusuario VARCHAR(100),
    caccion VARCHAR(50),
    ctabla VARCHAR(100),
    nregistro_id INTEGER,
    cdetalle TEXT,
    tcreado TIMESTAMP DEFAULT NOW()
);
```

### Campos Clave Detectados

- **Fecha de expiración**: `bot_lotes.dfecha_vencimiento`
- **Stock**: `bot_productos.nstock` (sistema NO usa stock por lote)
- **Unidad de medida**: NO existe campo específico
- **Fraccionamiento**: NO existe implementación
- **Lote**: Existe tabla `bot_lotes` pero el stock es global por producto

---

## 4. Lógica de Negocio Actual (Inventario y POS)

### Flujo de Venta

1. **Búsqueda de producto**: Frontend consulta `inventario.php` con filtro de texto
2. **Agregar al carrito**: Se añade item con `productoId`, `cantidad`, `precioUnit`
3. **Validación de stock**: Backend verifica stock disponible antes de confirmar
4. **Generación de código**: Formato `VTA-YYYYMMDD-XXXX`
5. **Transacción**: 
   - Inserta cabecera en `bot_ventas`
   - Inserta detalle en `bot_ventas_det`
   - Descuenta stock en `bot_productos`
   - Registra auditoría

### Control de Stock

- Stock es GLOBAL por producto (`bot_productos.nstock`)
- NO existe control de stock por lote
- NO existe lógica FEFO (First Expired First Out)
- NO existe fraccionamiento de productos
- La validación ocurre en `ventas.php` líneas 117-131

**NO se encontró implementación de FEFO en el proyecto actual.**

**NO se encontró implementación de fraccionamiento farmacéutico.**

### Endpoints API Clave

- `GET /api/inventario` - Listar productos con stock
- `POST /api/ventas` - Crear venta con detalle
- `GET /api/productos` - CRUD productos

---

## 5. Código Crítico

### Frontend: Componente POS (sales-page.tsx)

```typescript
// Imports principales
import { useState, useMemo, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Receipt, ShoppingCart, Trash2, Minus, Plus, Package, Search } from "lucide-react"
import { PaymentMethod } from "@/data/types"

// Tipos principales
interface CartItem {
  id: number
  name: string
  category: string
  location: string
  quantity: number
  unitPrice: number
  stock: number
  productId: number
}

interface InventoryItem {
  nid: number
  cnombre: string
  ccodigo: string
  cdescripcion: string
  nstock: number
  nprecio: number
  nprecio_compra: number
  ccategoria: string
  clote: string
}

// Estado principal del POS
export default function SalesPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("Efectivo")
  const [isPending, startTransition] = useTransition()

  // Buscar productos
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setInventory([])
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch(`/api/inventario?search=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error("Error en la búsqueda")
      const data = await response.json()
      setInventory(data)
    } catch (error) {
      console.error("Error searching inventory:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Agregar al carrito
  const addToCart = (item: InventoryItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.nid)
      if (existing) {
        return prev.map((i) =>
          i.id === item.nid
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [
        ...prev,
        {
          id: item.nid,
          name: item.cnombre,
          category: item.ccategoria || "Sin categoría",
          location: item.clote || "S/N",
          quantity: 1,
          unitPrice: Number(item.nprecio) || 0,
          stock: item.nstock,
          productId: item.nid,
        },
      ]
    })
    setSearchQuery("")
    setInventory([])
  }

  // Actualizar cantidad
  const updateItemQuantity = (id: number, newQuantity: number) => {
    if (newQuantity < 1) return
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: newQuantity } : item
      )
    )
  }

  // Remover item
  const removeItem = (id: number) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id))
  }

  // Calcular totales
  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }, [cartItems])

  const cartUnits = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0)
  }, [cartItems])

  // Submit venta
  const handleSaleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const saleData = {
      patient: formData.get("patient") as string,
      dniCliente: formData.get("dniCliente") as string,
      paymentMethod: formData.get("paymentMethod") as PaymentMethod,
      cashier: formData.get("cashier") as string,
      area: formData.get("area") as string,
      notes: formData.get("notes") as string,
      items: cartItems.map((item) => ({
        tipo: "Producto",
        productoId: item.productId,
        servicioId: 0,
        cantidad: item.quantity,
        precioUnit: item.unitPrice,
        descripcion: item.name,
      })),
    }

    try {
      const response = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(saleData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Error al procesar la venta")
      }

      const result = await response.json()
      
      // Reset carrito
      setCartItems([])
      setIsCheckoutOpen(false)
      
      // Mostrar resumen
      setIsSummaryOpen(true)
    } catch (error) {
      console.error("Error submitting sale:", error)
      alert(error instanceof Error ? error.message : "Error al procesar la venta")
    }
  }

  // Renderizado del carrito (simplificado)
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-surface rounded-xl shadow-sm border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-primary">Terminal de Venta</h1>
            <p className="text-sm text-muted mt-1">Boleta #45829 • 24 Oct 2023</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Receipt className="h-4 w-4" />
              Resumen de Turno
            </Button>
            <Button variant="default" className="bg-primary hover:bg-primary/90 gap-2">
              <ShoppingCart className="h-4 w-4" />
              Finalizar Venta
            </Button>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <Card>
        <CardContent className="p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              placeholder="Buscar producto por nombre o código..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          
          {/* Resultados de búsqueda */}
          {inventory.length > 0 && (
            <div className="mt-4 border rounded-md max-h-60 overflow-y-auto">
              {inventory.map((item) => (
                <button
                  key={item.nid}
                  className="w-full text-left px-4 py-3 hover:bg-accent border-b last:border-b-0 flex justify-between items-center"
                  onClick={() => addToCart(item)}
                >
                  <div>
                    <p className="font-medium text-foreground">{item.cnombre}</p>
                    <p className="text-xs text-muted">{item.ccategoria} | Stock: {item.nstock}</p>
                  </div>
                  <p className="font-semibold text-primary">S/{item.nprecio}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de items en carrito */}
      <Card>
        <CardContent className="p-0">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-surface border-b border-border text-xs font-semibold text-muted uppercase">
            <div className="col-span-4">Producto</div>
            <div className="col-span-2 text-center">Cantidad</div>
            <div className="col-span-2 text-right">P. Unitario</div>
            <div className="col-span-2 text-right">Subtotal</div>
            <div className="col-span-2 text-center">Acciones</div>
          </div>
          
          {cartItems.length > 0 ? (
            cartItems.map((item) => {
              const subtotal = item.quantity * item.unitPrice
              const exceedsStock = item.stock > 0 && item.quantity > item.stock

              return (
                <div key={item.id} className="grid grid-cols-12 gap-4 px-5 py-4 items-center border-b border-border">
                  <div className="col-span-4">
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="text-xs text-muted">{item.category} | Lote: {item.location}</p>
                    {exceedsStock && (
                      <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                        <span className="text-red-500">⚠</span>
                        Excede stock disponible
                      </p>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center justify-center gap-1">
                    <button
                      className="h-8 w-8 flex items-center justify-center rounded border border-border bg-surface"
                      onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <input
                      className="h-8 w-14 text-center font-semibold border border-border rounded"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItemQuantity(item.id, Number(e.target.value) || 1)}
                    />
                    <button
                      className="h-8 w-8 flex items-center justify-center rounded border border-border bg-surface"
                      onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="col-span-2 text-right">
                    <p className="font-semibold text-primary">S/{item.unitPrice.toFixed(2)}</p>
                  </div>

                  <div className="col-span-2 text-right">
                    <p className="font-bold text-foreground">S/{subtotal.toFixed(2)}</p>
                  </div>

                  <div className="col-span-2 text-center">
                    <Button
                      className="text-red-500 hover:text-red-700 hover:bg-destructive/10"
                      onClick={() => removeItem(item.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="p-8 text-center text-muted/70">
              <ShoppingCart className="mx-auto h-10 w-10 mb-2" />
              <p>No hay items en la venta</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumen inferior */}
      <div className="bg-surface rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-xs text-muted uppercase">Items</p>
              <p className="text-lg font-semibold text-foreground">{cartItems.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase">Unidades</p>
              <p className="text-lg font-semibold text-foreground">{cartUnits}</p>
            </div>
            <div className="border-l border-border pl-8">
              <p className="text-xs text-muted uppercase">Subtotal</p>
              <p className="text-lg font-semibold text-foreground">S/ {cartTotal.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted uppercase">IGV (18%)</p>
              <p className="text-lg font-semibold text-foreground">S/ {(cartTotal * 0.18).toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-muted uppercase">Total a Pagar</p>
              <p className="text-2xl font-bold text-primary">S/ {(cartTotal * 1.18).toFixed(2)}</p>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-semibold"
              onClick={() => setIsCheckoutOpen(true)}
              disabled={cartItems.length === 0}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Finalizar Venta
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog de checkout */}
      <Dialog className="max-w-3xl" onClose={() => setIsCheckoutOpen(false)} open={isCheckoutOpen}>
        <form className="space-y-4" onSubmit={handleSaleSubmit}>
          <label className="space-y-2">
            <span className="text-sm font-semibold">Cliente</span>
            <Input defaultValue="Consumidor final" name="patient" required />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold">Metodo de pago</span>
              <select name="paymentMethod" defaultValue={selectedPaymentMethod}>
                <option>Efectivo</option>
                <option>Yape</option>
                <option>Mixto</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold">Caja</span>
              <Input defaultValue="Caja principal" name="cashier" required />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-semibold">Observaciones</span>
            <Textarea name="notes" placeholder="Notas adicionales..." />
          </label>

          <div className="mt-5 rounded-[20px] bg-primary px-4 py-5 text-primary-foreground">
            <p className="text-sm text-primary-foreground/75">Total final</p>
            <p className="mt-2 font-display text-3xl font-semibold">S/ {cartTotal.toFixed(2)}</p>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90">
              Confirmar Venta
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
```

### Backend: Controlador de Ventas (ventas.php)

```php
<?php
session_start();
require_once __DIR__ . '/Clases/CBase.php';
require_once __DIR__ . '/Clases/CSql.php';
cors();
requireAuth();

$oSql = new CSql();
if (!$oSql->omConnect()) {
   jsonError('ERROR DE CONEXION', 500);
}

$method = $_SERVER['REQUEST_METHOD'];

// ── GET: listar ventas con detalle ──
if ($method === 'GET') {
   // Si piden detalle de una venta
   if (!empty($_GET['id'])) {
      $id = intval($_GET['id']);
      $RS = $oSql->omExec("SELECT nid, ccodigo, ccliente, cnrodni_cli, cmetpago, carea, ccaja, nsubtotal, nigv, ntotal, cnotas, cestado, tcreado::TEXT FROM bot_ventas WHERE nid=$id");
      $venta = $oSql->fetchAssoc($RS);
      if (!$venta) { jsonError('VENTA NO ENCONTRADA', 404); }

      $detRS = $oSql->omExec("SELECT d.nid, d.ctipo, d.nproducto_id, d.nservicio_id, d.ncantidad, d.npreunit, d.nsubtotal, d.cdescripcion,
         COALESCE(p.cnombre,'') AS producto_nombre, COALESCE(s.cnombre,'') AS servicio_nombre
         FROM bot_ventas_det d LEFT JOIN bot_productos p ON p.nid=d.nproducto_id LEFT JOIN bot_servicios s ON s.nid=d.nservicio_id
         WHERE d.nventa_id=$id");
      $detalle = [];
      while ($dr = $oSql->fetchAssoc($detRS)) { $detalle[] = $dr; }

      $oSql->omDisconnect();
      jsonResponse(['venta' => $venta, 'detalle' => $detalle]);
   }

   // Listado general
   $RS = $oSql->omExec("SELECT nid, ccodigo, ccliente, cmetpago, carea, ccaja, ntotal, cnotas, cestado, tcreado::TEXT FROM bot_ventas WHERE cestado IN ('A','F') ORDER BY tcreado DESC LIMIT 50");
   $items = [];
   while ($row = $oSql->fetchAssoc($RS)) {
      $items[] = [
         'id' => $row['nid'],
         'codigo' => trim($row['ccodigo']),
         'concept' => trim($row['cnotas'] ?? ''),
         'patient' => trim($row['ccliente']),
         'paymentMethod' => trim($row['cmetpago']),
         'area' => trim($row['carea'] ?? ''),
         'cashier' => trim($row['ccaja'] ?? ''),
         'total' => floatval($row['ntotal']),
         'at' => $row['tcreado'],
      ];
   }
   $oSql->omDisconnect();
   jsonResponse($items);
}

// ── POST: crear venta con detalle ──
if ($method === 'POST') {
   $data = getJsonInput();
   $patient = $oSql->escape($data['patient'] ?? 'Consumidor final');
   $dniCli = $oSql->escape($data['dniCliente'] ?? '');
   $paymentMethod = $oSql->escape($data['paymentMethod'] ?? 'Efectivo');
   $cashier = $oSql->escape($data['cashier'] ?? 'Caja principal');
   $area = $oSql->escape($data['area'] ?? 'Botica');
   $notes = $oSql->escape($data['notes'] ?? '');
   $items = $data['items'] ?? [];
   $userId = intval($_SESSION['USER_ID']);

   // Codigo unico
   $RS = $oSql->omExec("SELECT CURRENT_DATE::TEXT");
   $r = $oSql->fetch($RS);
   $today = str_replace('-', '', $r[0]);
   $RS = $oSql->omExec("SELECT COUNT(*)+1 FROM bot_ventas WHERE tcreado::DATE = CURRENT_DATE");
   $r = $oSql->fetch($RS);
   $codigo = 'VTA-' . $today . '-' . str_pad($r[0], 4, '0', STR_PAD_LEFT);

   // Calcular totales desde items
   $subtotal = 0;
   foreach ($items as $it) {
      $subtotal += floatval($it['cantidad'] ?? 1) * floatval($it['precioUnit'] ?? 0);
   }
   // Si no hay items, usar total directo (venta rapida)
   if (empty($items)) {
      $subtotal = floatval($data['total'] ?? 0);
   }
   $total = $subtotal;

   // Iniciar transaccion
   $oSql->omExec("BEGIN");

   $sql = "INSERT INTO bot_ventas (ccodigo, ccliente, cnrodni_cli, cmetpago, carea, ccaja, nsubtotal, ntotal, cnotas, nusuario_id)
           VALUES ('$codigo', '$patient', '$dniCli', '$paymentMethod', '$area', '$cashier', $subtotal, $total, '$notes', $userId) RETURNING nid";
   $RS = $oSql->omExec($sql);
   if (!$RS) {
      $oSql->omRollback();
      $oSql->omDisconnect();
      jsonError('ERROR AL GUARDAR VENTA');
   }
   $row = $oSql->fetch($RS);
   $ventaId = intval($row[0]);

   // Insertar detalle y descontar stock
   foreach ($items as $it) {
      $tipo = $oSql->escape($it['tipo'] ?? 'Producto');
      $prodId = intval($it['productoId'] ?? 0);
      $servId = intval($it['servicioId'] ?? 0);
      $cant = intval($it['cantidad'] ?? 1);
      $precio = floatval($it['precioUnit'] ?? 0);
      $sub = $cant * $precio;
      $desc = $oSql->escape($it['descripcion'] ?? '');

      $prodCol = $prodId > 0 ? $prodId : 'NULL';
      $servCol = $servId > 0 ? $servId : 'NULL';

      $oSql->omExec("INSERT INTO bot_ventas_det (nventa_id, ctipo, nproducto_id, nservicio_id, ncantidad, npreunit, nsubtotal, cdescripcion)
                      VALUES ($ventaId, '$tipo', $prodCol, $servCol, $cant, $precio, $sub, '$desc')");

      // Descontar stock si es producto
      if ($tipo === 'Producto' && $prodId > 0) {
         $stockRS = $oSql->omExec("SELECT cnombre, nstock FROM bot_productos WHERE nid = $prodId FOR UPDATE");
         $stockRow = $oSql->fetchAssoc($stockRS);
         if (!$stockRow) {
            $oSql->omRollback();
            $oSql->omDisconnect();
            jsonError('PRODUCTO NO ENCONTRADO', 404);
         }
         if (intval($stockRow['nstock']) < $cant) {
            $oSql->omRollback();
            $oSql->omDisconnect();
            jsonError('STOCK INSUFICIENTE PARA ' . trim($stockRow['cnombre']));
         }
         $oSql->omExec("UPDATE bot_productos SET nstock = nstock - $cant, tmodifi = NOW() WHERE nid = $prodId");
      }
   }

   // Auditoria
   $usuario = $oSql->escape($_SESSION['USER_NOMBRE'] ?? '');
   $oSql->omExec("INSERT INTO bot_auditoria (nusuario_id, cusuario, caccion, ctabla, nregistro_id, cdetalle)
                   VALUES ($userId, '$usuario', 'VENTA', 'bot_ventas', $ventaId, 'Venta $codigo por S/$total $paymentMethod')");

   $oSql->omExec("COMMIT");
   $oSql->omDisconnect();
   jsonResponse(['ok' => true, 'id' => $ventaId, 'codigo' => $codigo, 'total' => $total]);
}

$oSql->omDisconnect();
jsonError('METODO NO PERMITIDO', 405);
?>
```

### Backend: API Inventario (inventario.php)

```php
<?php
session_start();
require_once __DIR__ . '/Clases/CBase.php';
require_once __DIR__ . '/Clases/CSql.php';
cors();
requireAuth();

$oSql = new CSql();
if (!$oSql->omConnect()) {
   jsonError('ERROR DE CONEXION', 500);
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
   $search = $_GET['search'] ?? '';
   $search = $oSql->escape($search);
   
   // Consulta con joins a lotes y categorías
   $sql = "SELECT 
            p.nid,
            p.ccodigo,
            p.cnombre,
            p.cdescripcion,
            p.nstock,
            p.nprecio,
            p.nprecio_compra,
            c.cnombre as ccategoria,
            l.ccodigo as clote,
            l.dfecha_vencimiento
          FROM bot_productos p
          LEFT JOIN bot_categorias c ON c.nid = p.ncategoria_id
          LEFT JOIN bot_lotes l ON l.nid = p.nlote_id
          WHERE p.nestado = 1
          AND (p.cnombre ILIKE '%$search%' OR p.ccodigo ILIKE '%$search%')
          AND p.nstock > 0
          ORDER BY p.cnombre
          LIMIT 50";
   
   $RS = $oSql->omExec($sql);
   $items = [];
   while ($row = $oSql->fetchAssoc($RS)) {
      $items[] = [
         'nid' => intval($row['nid']),
         'ccodigo' => trim($row['ccodigo']),
         'cnombre' => trim($row['cnombre']),
         'cdescripcion' => trim($row['cdescripcion'] ?? ''),
         'nstock' => intval($row['nstock']),
         'nprecio' => floatval($row['nprecio']),
         'nprecio_compra' => floatval($row['nprecio_compra']),
         'ccategoria' => trim($row['ccategoria'] ?? ''),
         'clote' => trim($row['clote'] ?? ''),
         'dfecha_vencimiento' => $row['dfecha_vencimiento'],
      ];
   }
   
   $oSql->omDisconnect();
   jsonResponse($items);
}

jsonError('METODO NO PERMITIDO', 405);
?>
```

---

## 6. Notas para Migración

### FEFO (First Expired First Out)
- **Estado actual**: NO implementado
- **Requerimiento**: El sistema debe seleccionar automáticamente el lote con fecha de vencimiento más próxima al hacer ventas
- **Implementación sugerida**: 
  - Modificar query de inventario para ordenar por `dfecha_vencimiento ASC`
  - Descuentar stock del lote específico, no del producto global

### Fraccionamiento
- **Estado actual**: NO implementado
- **Requerimiento farmacéutico**: Algunos productos vienen en cajas pero se venden en unidades
- **Campos necesarios**: 
  - `nunidad_por_caja` (cuántas unidades/blister vienen)
  - `ctipo_venta` ('caja' | 'unidad')
  - Lógica para convertir y trackear stock fraccionado

### Mejoras Recomendadas

1. **Stock por lote**: Separar `nstock` de `bot_productos` a una tabla intermedia o mantener en `bot_lotes`
2. **Unidad de medida**: Agregar campo `cunidad_medida` (tabletas, ml, gr, caja)
3. **Estado de lote**: Agregar flag para lotes vencidos o por vencer
4. **Historial de stock**: Tabla `bot_stock_historial` para trazabilidad

---

*Documento generado el 10 Abril 2026*
*Para uso del Lead Developer AI en migración del sistema*

---

## Módulo Clínico (Consultorio + Recetas)

### Estructura de Tablas

```
┌─────────────────────────────────────────────────────────────────────────┐
│ PACIENTES ──► HISTORIAS_CLINICAS ──► RECETAS ──► RECETAS_DETALLE      │
│                                 │                                      │
│ HISTORIAS_DIAGNOSTOS ◄──────────┘                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tablas Principales

| Tabla | Descripción | Campos Clave |
|-------|-------------|--------------|
| `pacientes` | Registro de pacientes | `codigo_historia`, `alergias`, `grupo_sanguineo` |
| `historias_clinicas` | Consultas médicas | `signos_vitales`, `diagnostico_principal`, `tratamiento` |
| `recetas` | Recetas emitidas | `codigo` (REC-YYYYMMDD-XXXX), `estado`, `fecha_vencimiento` |
| `recetas_detalle` | Medicamentos de receta | `cantidad_recetada/despachada`, `dosis`, `frecuencia` |

### Estados de Receta

| Estado | Significado |
|--------|-------------|
| `ACTIVA` | Pendiente de despacho completo |
| `PARCIAL` | Algunos items despachados |
| `COMPLETADA` | Todos los items despachados |
| `VENCIDA` | Pasó fecha límite (30 días) |
| `ANULADA` | Cancelada por médico |

### Estados de Item de Receta

| Estado | Significado |
|--------|-------------|
| `PENDIENTE` | Sin despachar |
| `PARCIAL` | Despachado parcial |
| `COMPLETADO` | Despachado completo |
| `NO_DISPONIBLE` | Sin stock en farmacia |

### Vistas SQL

| Vista | Propósito |
|-------|-----------|
| `vista_recetas_pendientes` | Recetas activas listas para POS |
| `vista_receta_detalle_pos` | Items con info de stock disponible |
| `vista_pacientes_resumen` | Ficha resumen del paciente |

### Funciones SQL

| Función | Propósito |
|---------|-----------|
| `buscar_recetas_paciente(paciente_id)` | Recetas del paciente |
| `get_receta_para_pos(receta_id)` | Formato POS con stock |
| `crear_consulta_con_receta(...)` | Consulta + receta en un llamado |
| `verificar_receta_disponible(codigo)` | Valida si puede despacharse |

### API Endpoints

```
GET    /clinical/pacientes/buscar?q=...
GET    /clinical/pacientes/:id/ficha
GET    /clinical/pacientes/:id/recetas
GET    /clinical/recetas/pendientes
GET    /clinical/recetas/verificar?codigo=REC-xxx
GET    /clinical/recetas/:id/pos
POST   /clinical/consultas
```

### Flujo Completo: Médico → POS

```
1. Médico crea consulta:
   POST /clinical/consultas
   { paciente_id, diagnostico, receta: { medicamentos: [...] } }
   
   → Genera código: REC-20240120-0001

2. Cajero carga receta en POS:
   GET /clinical/recetas/verificar?codigo=REC-20240120-0001
   → Verifica disponibilidad
   
   GET /clinical/recetas/:id/pos
   → Obtiene items con stock FEFO

3. POS carga en carrito:
   { producto_id, cantidad: 20, receta_id, receta_detalle_id }

4. Venta vincula:
   POST /ventas
   { paciente_id, items: [{..., receta_id, receta_detalle_id}] }

5. TRIGGER auto-actualiza:
   UPDATE recetas_detalle SET estado='COMPLETADO'
   UPDATE recetas SET estado='COMPLETADA' (si todos)
```

### Archivos del Módulo

```
supabase/clinical_module.sql       → SQL completo
src/services/clinical.service.ts   → Servicio backend
src/routes/clinical.routes.ts      → API endpoints
docs/guides/clinical_guia.md       → Documentación
```

### Reglas de Negocio Clave

1. **Vinculación obligatoria**: Toda venta de receta incluye `receta_id` y `receta_detalle_id`
2. **Despacho parcial**: Se permite despachar menos de lo recetado
3. **Vencimiento**: Recetas vencen automáticamente a los 30 días
4. **FEFO**: POS aplica FEFO automáticamente al despachar medicamentos de receta
5. **Auditoría**: Kardex registra venta con `receta_id` para trazabilidad completa

---

*Actualizado: 10 Abril 2026*
