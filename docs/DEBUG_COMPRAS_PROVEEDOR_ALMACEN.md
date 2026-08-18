# DEBUG_COMPRAS_PROVEEDOR_ALMACEN

## 1. Causa raíz del problema

La causa real no estaba en un `select` roto, sino en la forma de cargar la pantalla de compras.

Antes:

- `frontend/src/pages/compras-page.tsx` cargaba `compras`, `proveedores`, `inventario` y `almacenes` con un único `Promise.all(...)`
- si fallaba cualquiera de esas 4 llamadas, fallaban también los catálogos visibles para el formulario
- el usuario solo veía un `toast` genérico: `Error al cargar`
- el formulario quedaba aparentando que no había proveedores o almacenes, aunque esos endpoints sí podían estar respondiendo bien

En otras palabras:

- un fallo en `/api/v1/compras` o `/api/v1/inventario`
- podía dejar vacíos también proveedor y almacén
- y el error quedaba silencioso respecto de cuál catálogo falló realmente

## 2. Archivos corregidos

- `frontend/src/pages/compras-page.tsx`
- `frontend/src/pages/compras-page.test.tsx`
- `backend-fastify/src/__tests__/catalogos-compras.test.ts`

## 3. Endpoint real de proveedores

La pantalla de compras carga proveedores desde:

```text
GET /api/v1/proveedores
```

Implementación backend:

- `backend-fastify/src/routes/providers.routes.ts`

Comportamiento:

- requiere autenticación
- por defecto devuelve solo proveedores activos (`cestado = 'A'`)
- para compras no se usa `includeInactive`

Ejemplo real de JSON validado en test:

```json
[
  {
    "nid": 10,
    "cruc": "20100070970",
    "cnombre": "Distribuidora Farma SAC",
    "ccontacto": "Ana Torres",
    "ctelefono": "999888777",
    "cemail": "ventas@farma.pe",
    "cdireccion": "Av. Industrial 123",
    "cnotas": "",
    "cestado": "A",
    "tcreado": "2026-04-12T10:00:00.000Z"
  }
]
```

## 4. Endpoint real de almacenes

La pantalla de compras carga almacenes desde:

```text
GET /api/v1/almacenes
```

Implementación backend:

- `backend-fastify/src/routes/almacenes.routes.ts`

Comportamiento:

- requiere autenticación
- devuelve almacenes activos
- el frontend vuelve a filtrar `estado === 'A'` para blindaje adicional

Ejemplo real de JSON validado en test:

```json
[
  {
    "id": 3,
    "localId": 1,
    "localNombre": "Botica Central",
    "localTipo": "BOTICA",
    "nombre": "Disponible Principal",
    "codigo": "ALM-BOT-DISP",
    "tipoAlmacen": "DISPONIBLE",
    "permiteVenta": true,
    "permiteConsumoClinico": false,
    "requiereRevision": false,
    "estado": "A",
    "creado": "2026-04-12T10:00:00.000Z",
    "lotesActivos": 2,
    "stockTotal": 50
  }
]
```

## 5. Shape de respuesta esperado

### Proveedores

Campos usados por compras:

- `nid`
- `cnombre`
- `cruc`
- `cestado`

Mapeo final en el select:

```ts
value = String(provider.nid)
label = `${provider.cnombre.trim()} · RUC ${(provider.cruc ?? '').trim() || '-'}`
```

### Almacenes

Campos usados por compras:

- `id`
- `localNombre`
- `nombre`
- `tipoAlmacen`
- `estado`

Mapeo final en el select:

```ts
value = String(almacen.id)
label = `${almacen.localNombre} · ${almacen.nombre} · ${almacen.tipoAlmacen}`
```

## 6. Payload final de compra

La nomenclatura quedó unificada en frontend y backend:

- `proveedorId`
- `almacenId`
- `tipoComprobante`
- `numeroDocumento`

Payload final enviado al guardar:

```json
{
  "proveedorId": 10,
  "almacenId": 3,
  "tipoComprobante": "FACTURA",
  "numeroDocumento": "F001-00012345",
  "notas": "",
  "items": [
    {
      "productoId": 1,
      "cantidad": 1,
      "precioUnit": 2.5,
      "codigoLote": "LT-001",
      "fechaVencimiento": "2027-01-01"
    }
  ]
}
```

## 7. Qué se corrigió en el frontend

En `frontend/src/pages/compras-page.tsx`:

- se eliminó la dependencia total de un único `Promise.all`
- se reemplazó por `Promise.allSettled(...)`
- cada fuente ahora carga de forma independiente:
  - compras
  - proveedores
  - productos
  - almacenes
- si falla una, las demás siguen cargando
- se agregaron mensajes visibles en pantalla:
  - `No se pudieron cargar las compras`
  - `No se pudieron cargar los proveedores`
  - `No se pudieron cargar los productos`
  - `No se pudieron cargar los almacenes`
- se agregó mapeo explícito de opciones para proveedor y almacén
- se deshabilitan los selects si no hay opciones válidas
- el submit ahora arma el payload con una función explícita que preserva:
  - `proveedorId`
  - `almacenId`

## 8. Qué se confirmó del backend

No fue necesario cambiar la lógica principal del backend para este bug.

Se confirmó que:

- compras usa proveedores desde `GET /api/v1/proveedores`
- compras usa almacenes desde `GET /api/v1/almacenes`
- el backend de compra recibe y valida:
  - `proveedorId`
  - `almacenId`
  - `tipoComprobante`
  - `numeroDocumento`
- el backend rechaza:
  - proveedor inexistente
  - almacén inexistente o inactivo
  - falta de proveedor
  - falta de almacén

## 9. Validación realizada

Validación automatizada ejecutada:

- `cd backend-fastify && npm test -- --run src/__tests__/catalogos-compras.test.ts src/__tests__/purchases.test.ts`
- `cd frontend && npm test -- --run src/pages/compras-page.test.tsx`

Cobertura validada:

- `/api/v1/proveedores` devuelve shape usable por compras
- `/api/v1/almacenes` devuelve shape usable por compras
- la pantalla renderiza opciones de proveedor y almacén
- si falla otra carga, los catálogos siguen visibles
- el submit manda `proveedorId` y `almacenId` correctos

Nota honesta:

- en este turno no levanté un navegador interactivo real
- la validación funcional se hizo mediante pruebas automatizadas de render y payload, más validación de endpoints backend
