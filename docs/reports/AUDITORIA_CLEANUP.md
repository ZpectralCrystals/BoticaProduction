# AUDITORÍA CLEANUP — Botica El Pueblo
> Generado: 2026-04-11  
> Alcance: repositorio completo `/BoticaElPueblo`

---

## Resumen ejecutivo

### Estado general del repositorio: **MODERADAMENTE SUCIO** (6/10)

El proyecto se encuentra en una **migración parcial incompleta** desde un backend PHP (`backend/`) hacia un backend Fastify (`backend-fastify/`). La capa frontend React ya opera 100% contra Fastify, pero el backend PHP sigue conviviendo en el repositorio sin propósito activo. Adicionalmente existe una capa de servicios/rutas Fastify duplicada — algunos módulos tienen **dos implementaciones paralelas** (ej. `ventas.routes.ts` vs `sales.routes.ts`, `inventario.routes.ts` vs `inventory.routes.ts`) una que usa Supabase (la arquitectura nueva no registrada) y otra que usa `fastify.db` PostgreSQL directo (la operativa real). Esto genera confusión severa sobre cuál es el backend real.

### Partes que mezclan arquitectura vieja y nueva

| Área | Problema |
|---|---|
| `backend/` (PHP) | Sistema viejo completo, totalmente reemplazado por Fastify |
| `backend-fastify/src/routes/ventas.routes.ts` | Usa Supabase + `VentasService` — **NO registrado en server.ts** |
| `backend-fastify/src/routes/inventario.routes.ts` | Usa Supabase + `InventarioService` — **NO registrado en server.ts** |
| `backend-fastify/src/routes/kardex.routes.ts` | Usa Supabase + `KardexService` — **NO registrado en server.ts** |
| `backend-fastify/src/routes/clinical.routes.ts` | Usa Supabase + `ClinicalService` — **NO registrado en server.ts** |
| `backend-fastify/src/plugins/supabase.ts` | Plugin Supabase no registrado en `server.ts` |
| `backend-fastify/src/services/` | 4 servicios Supabase sin uso real |
| `frontend/src/services/api.ts` | Cliente HTTP alternativo (`ApiService` class), no usado en páginas activas |
| `frontend/src/data/types.ts` | Datos mock hardcoded (`initialInventory`, etc.) huérfanos |
| `frontend/src/lib/clerk.ts` | Integración Clerk nunca activada, sin referencia en el proyecto |
| `frontend/src/pos/` (SalesPOS, usePOS, useFEFO) | POS Supabase/FEFO complejo no usado desde `sales-page.tsx` |
| Markdowns de auditoría en raíz | 6 archivos de auditoría previos acumulados |

### Principales riesgos

1. **Confusión de rutas**: existen rutas `GET /inventario` con dos implementaciones distintas — la registrada (`inventory.routes.ts`) y la no registrada (`inventario.routes.ts`). Si alguien registra la segunda accidentalmente, choca.
2. **Dead code Supabase**: 4 services + 4 routes + 1 plugin usan Supabase pero server.ts nunca lo cargó. Cualquier import accidental rompe el build si no hay `SUPABASE_URL`.
3. **`frontend/src/services/api.ts`**: tiene una clase `ApiService` completa que apunta a `VITE_API_URL` absoluta (sin proxy Vite) — si se usa en producción, rompe CORS.
4. **`frontend/src/data/types.ts`**: exporta datos mock (`initialInventory`, `initialSales`, etc.) que ya no se consumen. Solo `InventoryItem`, `SaleRecord`, `PatientRecord`, `AppointmentRecord`, `ReportAlert` y los tipos base siguen siendo usados vía `app-data-context.tsx`.

---

## Inventario de código obsoleto

### Backend PHP (`backend/`)

| Ruta | Tipo | Motivo | Reemplazo | Seguridad |
|---|---|---|---|---|
| `backend/` (carpeta completa) | carpeta | Sistema PHP íntegro reemplazado por Fastify | `backend-fastify/` | **seguro** |
| `backend/index.php` | archivo | Entry point PHP | `backend-fastify/src/server.ts` | seguro |
| `backend/login.php` | archivo | Auth PHP | `auth.routes.ts` | seguro |
| `backend/ventas.php` | archivo | Ventas PHP | `sales.routes.ts` | seguro |
| `backend/inventario.php` | archivo | Inventario PHP | `inventory.routes.ts` | seguro |
| `backend/pacientes.php` | archivo | Pacientes PHP | `patients.routes.ts` | seguro |
| `backend/usuarios.php` | archivo | Usuarios PHP | `users.routes.ts` | seguro |
| `backend/dashboard.php` | archivo | Dashboard PHP | `dashboard.routes.ts` | seguro |
| `backend/caja.php` | archivo | Caja PHP | `caja.routes.ts` | seguro |
| `backend/compras.php` | archivo | Compras PHP | `purchases.routes.ts` | seguro |
| `backend/reportes.php` | archivo | Reportes PHP | `reports.routes.ts` | seguro |
| `backend/perfil.php` | archivo | Perfil PHP | `profile.routes.ts` | seguro |
| `backend/config.php` | archivo | Config DB PHP | variables de entorno Fastify | seguro |
| `backend/migrations/` | carpeta | Migraciones PHP antiguas | `schema_farmacia_completo.sql` | seguro |
| `backend/schema.sql` | archivo | Schema viejo PHP | `schema_farmacia_completo.sql` | seguro |
| `backend/Clases/` | carpeta | Clases PHP helper | N/A | seguro |

### Backend Fastify — rutas/servicios no registrados (arquitectura Supabase huérfana)

| Ruta | Tipo | Motivo | Reemplazo activo | Seguridad |
|---|---|---|---|---|
| `backend-fastify/src/routes/ventas.routes.ts` | archivo | NO registrado en server.ts; usa Supabase | `sales.routes.ts` | **revisar** |
| `backend-fastify/src/routes/inventario.routes.ts` | archivo | NO registrado en server.ts; usa Supabase | `inventory.routes.ts` | **revisar** |
| `backend-fastify/src/routes/kardex.routes.ts` | archivo | NO registrado en server.ts; sin registro | ninguno activo | revisar |
| `backend-fastify/src/routes/clinical.routes.ts` | archivo | NO registrado en server.ts; usa Supabase | `patients.routes.ts` (parcial) | revisar |
| `backend-fastify/src/plugins/supabase.ts` | archivo | No registrado en server.ts | plugin `db.ts` (PostgreSQL directo) | revisar |
| `backend-fastify/src/services/ventas.service.ts` | archivo | Solo lo usa `ventas.routes.ts` (no activo) | N/A | revisar |
| `backend-fastify/src/services/inventario.service.ts` | archivo | Solo lo usa `inventario.routes.ts` (no activo) | N/A | revisar |
| `backend-fastify/src/services/kardex.service.ts` | archivo | Solo lo usa `kardex.routes.ts` (no activo) | N/A | revisar |
| `backend-fastify/src/services/clinical.service.ts` | archivo | Solo lo usa `clinical.routes.ts` (no activo) | N/A | revisar |
| `backend-fastify/src/schemas/index.ts` | archivo | Zod schemas para rutas Supabase huérfanas | tipos inline en rutas activas | revisar |
| `backend-fastify/src/types/database.ts` | archivo | Types Supabase generados | N/A | revisar |

### Frontend — código muerto o huérfano

| Ruta | Tipo | Motivo | Seguridad |
|---|---|---|---|
| `frontend/src/lib/clerk.ts` | archivo | Clerk nunca activado, cero referencias en el proyecto | **seguro** |
| `frontend/src/services/api.ts` | archivo | `ApiService` class alternativa; solo usada por `useFEFO.ts` y `usePOS.ts` (ambos no activos desde `sales-page.tsx`) | revisar |
| `frontend/src/pos/components/SalesPOS.tsx` | componente | No referenciado desde `sales-page.tsx` ni router | revisar |
| `frontend/src/pos/hooks/usePOS.ts` | hook | Solo usado por `SalesPOS.tsx` (no activo) | revisar |
| `frontend/src/pos/hooks/useFEFO.ts` | hook | Solo usado por `ProductSearch.tsx` dentro de `SalesPOS` (no activo) | revisar |
| `frontend/src/hooks/use-local-storage.ts` | hook | Cero referencias en todo el frontend | **seguro** |
| `frontend/src/data/types.ts` — datos mock | constantes | `initialInventory`, `initialSales`, `initialPatients`, `initialAppointments`, `stackHighlights`, `moduleHighlights`, `operationalContext`, `baseReportAlerts` — CERO referencias externas | seguro (solo las constantes, los tipos del archivo sí se usan) |

### Archivos de documentación acumulados en raíz

| Archivo | Motivo | Seguridad |
|---|---|---|
| `AUDITORIA_BACKEND.md` | Auditoría previa de migración backend | seguro |
| `AUDITORIA_DB.md` | Auditoría previa de base de datos | seguro |
| `AUDITORIA_FRONTEND_POS.md` | Auditoría previa del POS | seguro |
| `AUDITORIA_RIESGOS.md` | Auditoría previa de riesgos | seguro |
| `docs/architecture/MODELO_BD.md` | Documento de modelo de BD previo | revisar |
| `docs/architecture/RESUMEN_EJECUTIVO_REFACTOR.md` | Resumen de refactor anterior | revisar |

---

## Inventario de duplicidad

### Backend — rutas duplicadas (dos implementaciones del mismo dominio)

| Dominio | Ruta activa (PostgreSQL/fastify.db) | Ruta huérfana (Supabase) |
|---|---|---|
| Ventas | `sales.routes.ts` ✅ registrado | `ventas.routes.ts` ❌ no registrado |
| Inventario | `inventory.routes.ts` ✅ registrado | `inventario.routes.ts` ❌ no registrado |
| Pacientes | `patients.routes.ts` ✅ registrado | `clinical.routes.ts` ❌ no registrado (incluye pacientes) |
| Kardex | ninguna activa | `kardex.routes.ts` ❌ no registrado |

### Frontend — dos clientes HTTP

| Módulo | Descripción | Usado activamente |
|---|---|---|
| `frontend/src/lib/api.ts` | Cliente funcional, proxy Vite, Bearer token, todas las páginas activas | ✅ SÍ (todas las páginas) |
| `frontend/src/services/api.ts` | Clase `ApiService` con URL absoluta, formato `{success, data}` | ⚠️ Solo por `usePOS.ts` y `useFEFO.ts` (POS no activo) |

### Frontend — `formatCurrency` duplicada

| Archivo | Función |
|---|---|
| `frontend/src/lib/utils.ts` | `formatCurrency()` — usado por páginas activas |
| `frontend/src/pos/utils/posUtils.ts` | `formatCurrency()` — duplicado, usado solo dentro del módulo POS |

### Backend — auth duplicada

| Módulo | Mecanismo | Estado |
|---|---|---|
| `backend-fastify/src/plugins/auth.ts` | `fastify.requireAuth` (JWT + `fastify.db`) | ✅ ACTIVO |
| `backend-fastify/src/routes/ventas.routes.ts` etc. | `authenticate` importado de `plugins/auth.js` (función alternativa) | Rutas no registradas |

### Esquemas/tipos duplicados

| Concepto | Frontend (`data/types.ts`) | Frontend (`pos/types/index.ts`) | Backend (`schemas/index.ts`) |
|---|---|---|---|
| Venta | `SaleRecord` | `VentaInput`, `VentaResponse` | `ventaCreateSchema`, `ventaResponseSchema` |
| Paciente | `PatientRecord` | — | `pacienteSchema` (en `clinical.routes.ts`) |
| Item inventario | `InventoryItem` | `Producto`, `Lote`, `LoteFEFO` | `productoSchema`, `loteSchema` |

### Lógica de negocio duplicada

| Lógica | Implementación 1 | Implementación 2 |
|---|---|---|
| Cálculo IGV | `posUtils.ts:calcularTotales` | `sales-page.tsx:cartSubtotal/cartIgv` (inline) |
| Format moneda | `lib/utils.ts:formatCurrency` | `pos/utils/posUtils.ts:formatCurrency` |
| Debounce | `pos/utils/posUtils.ts:debounce` | No hay otra — único |

---

## Dependencias sospechosas

### Backend Fastify

| Paquete | Estado | Motivo |
|---|---|---|
| `@supabase/supabase-js` | ⚠️ No usado en producción | Solo lo usan plugins/routes/services huérfanos (no registrados en `server.ts`) |
| `zod` | ⚠️ Solo en código huérfano | `schemas/index.ts` no usada por ninguna ruta activa; rutas activas validan inline |
| `fastify-plugin` (`fp`) | ⚠️ Solo en `supabase.ts` (no activo) y `auth.ts`, `db.ts` | Necesario para `auth.ts` y `db.ts` activos — **mantener** |

### Frontend

| Paquete | Estado | Motivo |
|---|---|---|
| Ningún paquete manifiestamente huérfano | — | El frontend no incluye Clerk pese a `clerk.ts` — si no está en `package.json` no hay riesgo |

---

## Riesgos

### NO tocar sin reemplazo

| Elemento | Riesgo si se borra |
|---|---|
| `backend-fastify/src/schemas/index.ts` | Los tipos `VentaCreateInput`, `PaginatedQuery` etc. podrían estar importados en rutas huérfanas — si se decide activar esas rutas en el futuro, se necesitarán |
| `backend-fastify/src/routes/kardex.routes.ts` | El kardex (movimientos de stock) no tiene implementación activa actualmente — puede necesitarse próximamente |
| `backend-fastify/src/routes/clinical.routes.ts` | Contiene lógica clínica detallada (historial, pacientes extendidos) que supera lo que hace `patients.routes.ts` |
| `docs/guides/clinical_guia.md` y `docs/guides/kardex_guia.md` | Documentación de arquitectura activa para los módulos en desarrollo |
| `schema_farmacia_completo.sql` y `local/backups/botica_db_backup.sql` | Referencias de esquema DB y backup — críticos |
| `docs/context/contexto_botica.md` | Contexto del negocio — referencia útil |
| `frontend/src/data/types.ts` — **los tipos** | `InventoryItem`, `SaleRecord`, `PatientRecord`, `AppointmentRecord`, `ReportAlert`, tipos de estado — usados activamente. Solo eliminar las constantes mock. |
| `frontend/src/pos/` (módulo completo) | Aunque no está activo desde `sales-page.tsx`, es el POS completo con FEFO y fraccionamiento. Representa trabajo considerable. Marcar como "desactivado" antes de borrar. |

### Puntos de ruptura potencial

- Borrar `backend/` no rompe nada en Fastify/frontend — **solo asegurarse de que no haya scripts en `start.sh` que lo levanten**
- Borrar `frontend/src/lib/clerk.ts` es seguro siempre que no haya variable de entorno `VITE_CLERK_PUBLISHABLE_KEY` activa
- Borrar las constantes mock de `data/types.ts` requiere edición del archivo (no borrado completo)

---

*Fin de auditoría*
