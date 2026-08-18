# Auditoría: Botón "Reponer" — Inventario ERP

**Fecha:** 2026-04-13  
**Auditor:** Senior Frontend + Backend + ERP Auditor  
**Estado final:** ❌ ELIMINADO — Reemplazado por navegación a Compras

---

## 1. Descripción actual del botón "Reponer"

**Ubicación:** `frontend/src/pages/inventory-page.tsx` línea 364–366  
**Condición de aparición:** Solo visible cuando `item.stock <= item.minStock`  
**Etiqueta visible:** `Reponer`  
**Interacción:** Clic directo, sin confirmación, sin formulario, sin parámetros del usuario

```tsx
// CÓDIGO ORIGINAL (ELIMINADO)
{item.stock <= item.minStock && (
  <Button size="sm" onClick={() => handleRestock(item)}>Reponer</Button>
)}
```

**Handler original:**
```ts
const handleRestock = async (item: ApiInventoryItem) => {
  const qty = item.minStock > 0 ? item.minStock : 10  // cantidad hardcodeada
  await apiRestock(item.id, qty)                       // sin diálogo, sin datos
}
```

**API call original:**
```ts
export function apiRestock(id: string, quantity: number) {
  return requestV1<{ ok: boolean }>('/inventario', {
    method: 'POST',
    body: JSON.stringify({ action: 'restock', id, quantity }),
  })
}
```

---

## 2. Comportamiento real detectado

**Backend — `inventory.routes.ts` (acción `restock`):**

```sql
-- ÚNICA operación ejecutada al presionar "Reponer":
UPDATE bot_productos SET nstock = nstock + $1, tmodifi = NOW() WHERE nid = $2
```

| Requisito ERP                   | ¿Lo cumplía? |
|---------------------------------|:---:|
| Crea lote en `bot_lotes`        | ❌ |
| Asigna `nalmacen_id` al lote    | ❌ |
| Exige fecha de vencimiento      | ❌ |
| Exige proveedor                 | ❌ |
| Exige almacén destino           | ❌ |
| Registra en `bot_kardex`        | ❌ |
| Registra en `bot_movimientos_almacen` | ❌ |
| Crea compra en `bot_compras`    | ❌ |
| Genera código de comprobante    | ❌ |
| Registra en `bot_auditoria`     | ❌ |
| Solicita confirmación al usuario | ❌ |

**Resultado:** Una sola línea SQL que incrementa `bot_productos.nstock` sin dejar ningún rastro en el sistema de trazabilidad.

---

## 3. Problemas encontrados

### CRITICO-1: Ruptura de FEFO
El stock aumenta en `bot_productos.nstock` pero no se crea ningún lote en `bot_lotes`. El motor FEFO busca lotes activos para descontar en ventas. El stock agregado por "Reponer" es **inasequible para el motor de ventas** — existe en el contador pero no en ningún lote. Resultado: ventas fallan o consumen de lotes equivocados.

### CRITICO-2: Kardex roto
No hay entrada en `bot_kardex`. El kardex es la fuente de verdad del historial de movimientos. Cualquier auditoría financiera, fiscal o sanitaria que revise el kardex encontrará stock sin origen.

### CRITICO-3: Sin trazabilidad de almacén
No hay entrada en `bot_movimientos_almacen`. El sistema no sabe en qué almacén entró el stock. El módulo de distribución (`/inventario/distribucion`) mostrará inconsistencias entre `bot_productos.nstock` y la suma de `bot_lotes.ncantidad` por almacén.

### CRITICO-4: Sin fecha de vencimiento (crítico farmacéutico)
En un sistema de farmacia, **toda unidad que ingresa debe tener lote y fecha de vencimiento** según regulación DIGEMID/SUNAT. El "Reponer" ingresa unidades sin fecha de vencimiento, invisibles para las alertas de vencimiento y el módulo de consistencia.

### CRITICO-5: Sin compra formal
No existe registro en `bot_compras`. No hay número de comprobante, proveedor, precio de compra ni referencia contable. El stock aparece de la nada — imposible de auditar.

### ALTO-6: Sin confirmación ni log de auditoría
El botón ejecuta el cambio con un solo clic. No hay diálogo de confirmación, no hay entrada en `bot_auditoria`. Un operario podría presionarlo accidentalmente o intencionalmente sin dejar rastro.

### MEDIO-7: Cantidad hardcodeada irracional
La cantidad se calcula como `item.minStock > 0 ? item.minStock : 10`. Esto significa que reponía exactamente el stock mínimo (ej: 5 unidades), no la diferencia hasta el stock deseado, no una cantidad razonable de compra. Operativamente inútil.

---

## 4. Clasificación del flujo

```
❌  Ingreso manual directo al stock bruto
    — Bypass completo del modelo ERP
    — Incompatible con FEFO, kardex, almacenes y trazabilidad
    — Inaceptable en un sistema farmacéutico regulado
```

No es un "ajuste de inventario" (que exigiría al menos kardex y motivo).  
No es una "compra encubierta" (falta todo el contexto de compra).  
Es un **parche de desarrollo** que nunca debió llegar a producción.

---

## 5. Decisión final tomada

### ❌ ELIMINAR completamente el flujo "Reponer"

**Justificación:**
- No existe forma segura de "arreglar" este flujo sin convertirlo en una compra — y ya existe el módulo de Compras que hace exactamente eso correctamente.
- Mantenerlo en cualquier forma genera confusión operativa y riesgo de uso incorrecto.
- El módulo de Compras ya captura: proveedor, almacén, lote, fecha de vencimiento, código de comprobante, kardex y movimiento de almacén.

### ✅ Reemplazar por: botón "Registrar compra" → navega a `/panel/compras`

El botón visible al usuario cuando hay stock bajo ya no ejecuta ninguna lógica — solo navega al módulo correcto, donde el operario registra la compra con todos los datos obligatorios.

---

## 6. Cambios realizados

### Frontend

**`frontend/src/pages/inventory-page.tsx`**
- Eliminada función `handleRestock`
- Eliminado import de `apiRestock`
- Botón "Reponer" → reemplazado por botón `"Registrar compra"` que navega a `/panel/compras` via `useNavigate`
- Botón sigue visible solo cuando `stock <= minStock` (alerta operativa mantenida)

```diff
- import { apiGetInventory, ..., apiRestock, ... } from '@/lib/api'
+ import { useNavigate } from 'react-router-dom'
+ import { apiGetInventory, ..., apiGetDistribucion, apiGetLocales } from '@/lib/api'

- const handleRestock = async (item: ApiInventoryItem) => {
-   const qty = item.minStock > 0 ? item.minStock : 10
-   await apiRestock(item.id, qty)
-   ...
- }

- <Button size="sm" onClick={() => handleRestock(item)}>Reponer</Button>
+ <Button size="sm" variant="outline" onClick={() => navigate('/panel/compras')}>Registrar compra</Button>
```

**`frontend/src/lib/api.ts`**
- Eliminada función `apiRestock` completamente

```diff
- export function apiRestock(id: string, quantity: number) {
-   return requestV1<{ ok: boolean }>('/inventario', {
-     method: 'POST',
-     body: JSON.stringify({ action: 'restock', id, quantity }),
-   })
- }
```

### Backend

**`backend-fastify/src/routes/inventory.routes.ts`**
- La acción `restock` ya no ejecuta el UPDATE — devuelve **HTTP 410 Gone** con mensaje explicativo

```diff
  if (action === 'restock') {
-   await fastify.db.query(
-     'UPDATE bot_productos SET nstock = nstock + $1, tmodifi = NOW() WHERE nid = $2',
-     [quantity, id],
-   )
-   return { ok: true }
+   return reply.code(410).send({
+     error: 'FLUJO_ELIMINADO',
+     message: 'El reabastecimiento directo fue eliminado. Registre una compra en /api/v1/compras.',
+   })
  }
```

> El endpoint retorna 410 (Gone) en lugar de eliminarse del código para que cualquier cliente legado que aún llame a esta acción reciba un error claro y descriptivo, no un 404 genérico.

---

## 7. Impacto en inventario y compras

| Área | Antes | Después |
|---|---|---|
| `bot_productos.nstock` | Podía ser incrementado sin lote | Solo cambia via compras/ajustes controlados |
| `bot_lotes` | No se creaba lote | Siempre se crea lote por compra |
| `bot_kardex` | Sin entrada | Kardex completo por compra |
| `bot_movimientos_almacen` | Sin entrada | Movimiento registrado por compra |
| Módulo FEFO | Stock fantasma (sin lote consumible) | Todo stock tiene lote FEFO válido |
| Dashboard consistencia | Reportaba inconsistencias | Stock siempre reconciliado |
| Auditoría | Sin rastro | Compra auditada con proveedor y comprobante |
| UX operario | Clic silencioso sin datos | Redirige a flujo completo y correcto |

### Flujo único de ingreso de stock (después de la corrección):

```
Módulo Compras → POST /api/v1/compras
  ├── Crea bot_compras (proveedor, comprobante, almacén)
  ├── Crea bot_lotes (código, fecha vencimiento, almacén, cantidad)
  ├── Actualiza bot_productos.nstock += cantidad
  ├── Inserta bot_kardex (tipo: COMPRA, lote, almacén, usuario)
  └── Inserta bot_movimientos_almacen (tipo: COMPRA, producto, almacén)
```

---

## 8. Validación final del sistema

```
Frontend TypeScript : ✅ npx tsc --noEmit — 0 errores
Frontend Tests      : ✅ 49/49 tests pasan
Backend TypeScript  : ✅ npx tsc --noEmit — 0 errores
Backend Tests       : ✅ 73/73 tests pasan
apiRestock          : ✅ eliminada del cliente
action restock      : ✅ retorna HTTP 410 con mensaje claro
Botón "Reponer"     : ✅ eliminado — reemplazado por "Registrar compra" → /panel/compras
FEFO                : ✅ no afectado (ya no se crea stock sin lote)
Kardex              : ✅ no afectado (ingreso solo via compras)
Movimientos almacén : ✅ no afectado
Consistencia        : ✅ check-schema.js confirma schema alineado
```

---

## Recomendación post-corrección

Si en el futuro se necesita un **ajuste de inventario** (ej: merma, conteo físico diferente al sistema), debe implementarse como un flujo separado con:

- Motivo obligatorio (`AJUSTE_CONTEO`, `MERMA`, `ROBO`, etc.)
- Entrada en `bot_kardex` con tipo `AJUSTE`
- Entrada en `bot_movimientos_almacen`
- Rol mínimo: `admin`
- Aprobación de supervisor (opcional)
- Referencia de auditoría

Este flujo **no existe aún** en el sistema y **no debe confundirse** con el botón "Reponer" eliminado.
