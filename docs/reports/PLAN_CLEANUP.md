# PLAN CLEANUP — Botica El Pueblo
> Basado en `docs/reports/AUDITORIA_CLEANUP.md`  
> Criterio: conservador primero, agresivo solo con evidencia total de que algo está muerto

---

## Fase A — Cleanup seguro (riesgo cero, ejecutar inmediatamente)

Todo lo listado aquí está inequívocamente muerto o reemplazado.

### A1. Eliminar backend PHP completo

| Acción | Ruta | Impacto esperado | Riesgo | Validación |
|---|---|---|---|---|
| Eliminar carpeta | `backend/` | Reduce ~80 KB de archivos PHP sin valor | Ninguno — Fastify ya cubre todo | `start.sh` ya no debe hacer referencia a PHP |

> **Verificar antes**: `grep -r "backend/" start.sh` — asegurarse que `start.sh` no levanta Apache/PHP.

---

### A2. Eliminar hook `use-local-storage.ts` (cero referencias)

| Acción | Ruta | Impacto | Riesgo | Validación |
|---|---|---|---|---|
| Eliminar archivo | `frontend/src/hooks/use-local-storage.ts` | Ninguno visible | Cero — sin imports | `grep -r "use-local-storage"` debe dar vacío |

---

### A3. Eliminar `frontend/src/lib/clerk.ts`

| Acción | Ruta | Impacto | Riesgo | Validación |
|---|---|---|---|---|
| Eliminar archivo | `frontend/src/lib/clerk.ts` | Ninguno | Cero — sin referencias activas | Build frontend no debe romper |

---

### A4. Eliminar constantes mock de `frontend/src/data/types.ts`

Los **tipos** del archivo siguen siendo usados. Solo eliminar las constantes hardcoded que ya no tienen referencias:

| Acción | Elemento | Riesgo |
|---|---|---|
| Eliminar constante | `initialInventory` | seguro |
| Eliminar constante | `initialSales` | seguro |
| Eliminar constante | `initialPatients` | seguro |
| Eliminar constante | `initialAppointments` | seguro |
| Eliminar constante | `stackHighlights` | seguro |
| Eliminar constante | `moduleHighlights` | seguro |
| Eliminar constante | `operationalContext` | seguro |
| Eliminar constante | `baseReportAlerts` | seguro |
| Eliminar funciones helpers internas | `dateOffset()`, `dateTimeOffset()` | seguro si quedan sin referencia tras borrar las constantes |

> **Mantener**: todos los `interface` y `type` del archivo.

**Validación**: `npx tsc --noEmit` no debe reportar errores nuevos.

---

### A5. Eliminar auditorías previas de la raíz

Estos archivos acumulan deuda documental de sesiones anteriores y ya están superados por la auditoría actual:

| Acción | Ruta | Riesgo |
|---|---|---|
| Eliminar | `AUDITORIA_BACKEND.md` | Ninguno |
| Eliminar | `AUDITORIA_DB.md` | Ninguno |
| Eliminar | `AUDITORIA_FRONTEND_POS.md` | Ninguno |
| Eliminar | `AUDITORIA_RIESGOS.md` | Ninguno |

> **Mantener**: `docs/architecture/MODELO_BD.md`, `docs/architecture/RESUMEN_EJECUTIVO_REFACTOR.md`, `docs/context/contexto_botica.md`, `README.md`.

---

## Fase B — Cleanup con refactor (requiere edición de código)

### B1. Consolidar `formatCurrency` (duplicada)

- `frontend/src/lib/utils.ts:formatCurrency` → fuente de verdad
- `frontend/src/pos/utils/posUtils.ts:formatCurrency` → **eliminar y reemplazar import**

| Acción | Detalle | Riesgo | Validación |
|---|---|---|---|
| Eliminar función duplicada | `posUtils.ts` línea ~67-73 | Bajo — solo cambiar import en componentes POS | Build + lint |
| Actualizar imports | `Cart.tsx`, `CheckoutModal.tsx`, `PaymentPanel.tsx`, `ProductSearch.tsx`, `SalesPOS.tsx` | Bajo | `grep formatCurrency` en `pos/` |

---

### B2. Desconectar y archivar el módulo POS completo

El módulo `frontend/src/pos/` (SalesPOS, usePOS, useFEFO, ProductSearch autónomo) no está activo desde `sales-page.tsx` y depende de `services/api.ts` (cliente alternativo) y de rutas Supabase no activas. Es trabajo considerable — **no borrar, archivar**.

| Acción | Detalle | Riesgo |
|---|---|---|
| Crear directorio `_archived/pos/` | Mover el módulo POS completo | Medio — si alguien lo importa indirectamente explota |
| Actualizar `pos/index.ts` | Vaciar barrel o marcar todo como deprecated con comentario | Bajo |
| Mantener `Cart.tsx`, `CheckoutModal.tsx`, `PaymentPanel.tsx` | Estos sí son usados por `sales-page.tsx` activa | **NO mover estos** |

> **Archivar solo**: `SalesPOS.tsx`, `usePOS.ts`, `useFEFO.ts`  
> **Mantener activos**: `Cart.tsx`, `CheckoutModal.tsx`, `PaymentPanel.tsx`, `posUtils.ts`, `types/index.ts`

---

### B3. Limpiar `frontend/src/services/api.ts`

Este archivo solo es importado por `usePOS.ts`, `useFEFO.ts` y `ProductSearch.tsx` — todos dentro del módulo POS no activo. Una vez archivado el módulo POS, este archivo queda sin referencia.

| Acción | Condición | Riesgo |
|---|---|---|
| Eliminar `frontend/src/services/api.ts` | Solo después de ejecutar B2 | Bajo si B2 ya está hecho |

---

### B4. Consolidar lógica IGV

Actualmente existen dos lugares que calculan base imponible / IGV:

- `posUtils.ts:calcularTotales` — fórmula `total / 1.18`
- `sales-page.tsx` — `cartSubtotal = cartTotal / 1.18` inline

**Acción**: que `sales-page.tsx` importe y use `calcularTotales` de `posUtils.ts` en lugar de calcular inline.

| Acción | Riesgo | Validación |
|---|---|---|
| Refactorizar `sales-page.tsx` para usar `calcularTotales` | Bajo | Smoke test de venta completa |

---

## Fase C — Cleanup delicado (validación manual antes de ejecutar)

### C1. Rutas Fastify huérfanas (Supabase)

Estos archivos tienen valor técnico potencial pero **no están activos**:

| Archivo | Situación | Recomendación |
|---|---|---|
| `backend-fastify/src/routes/ventas.routes.ts` | No registrado; usa Supabase; el dominio está cubierto por `sales.routes.ts` | Revisar si hay datos en ventas.routes que no están en sales.routes; luego eliminar |
| `backend-fastify/src/routes/inventario.routes.ts` | No registrado; usa Supabase; el dominio cubierto por `inventory.routes.ts` | Misma revisión — luego eliminar |
| `backend-fastify/src/routes/kardex.routes.ts` | No registrado; **sin equivalente activo** — es funcionalidad futura | Mover a `_draft/` o mantener hasta implementar |
| `backend-fastify/src/routes/clinical.routes.ts` | No registrado; funcionalidad clínica extendida sin equivalente activo | Mover a `_draft/` — no eliminar |

### C2. Servicios Supabase

| Archivo | Recomendación |
|---|---|
| `ventas.service.ts` | Eliminar cuando se confirme que `sales.routes.ts` cubre todo |
| `inventario.service.ts` | Eliminar cuando se confirme que `inventory.routes.ts` cubre todo |
| `kardex.service.ts` | Mantener — acompaña a `kardex.routes.ts` que tiene valor futuro |
| `clinical.service.ts` | Mantener — acompaña a `clinical.routes.ts` que tiene valor futuro |

### C3. Plugin y tipos Supabase

| Archivo | Recomendación |
|---|---|
| `backend-fastify/src/plugins/supabase.ts` | Eliminar cuando C1 esté ejecutado (solo lo necesitan las rutas huérfanas) |
| `backend-fastify/src/schemas/index.ts` | Mantener como referencia de contrato de API — puede ser útil para futura validación |
| `backend-fastify/src/types/database.ts` | Mantener — define tipos generados de Supabase que documentan el esquema |

### C4. Dependencia `@supabase/supabase-js` en backend-fastify

Una vez eliminados `supabase.ts`, `ventas.service.ts`, `inventario.service.ts` y sus routes:

```bash
npm uninstall @supabase/supabase-js --prefix backend-fastify
```

> Solo ejecutar después de confirmar que C1+C2 están completos y el build pasa.

---

## Orden de ejecución recomendado

```
Fase A1 → A2 → A3 → A4 → A5
   ↓
Fase B1 → B3 → B4
   ↓
Validar build frontend y backend
   ↓
Fase C1 (una ruta a la vez) → C2 → C3 → C4
```

---

*Fin del plan*
