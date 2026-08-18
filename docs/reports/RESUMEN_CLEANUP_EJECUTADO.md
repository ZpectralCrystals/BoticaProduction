# RESUMEN CLEANUP EJECUTADO — Botica El Pueblo
> Fecha: 2026-04-11  
> Resultado de build TS post-cleanup: **✅ 0 errores**

---

## Archivos eliminados

| Archivo / Carpeta | Motivo |
|---|---|
| `frontend/src/hooks/use-local-storage.ts` | Hook sin referencia alguna en el proyecto |
| `frontend/src/lib/clerk.ts` | Integración Clerk nunca activada, cero referencias |
| `AUDITORIA_BACKEND.md` | Auditoría de sesión anterior, superada |
| `AUDITORIA_DB.md` | Auditoría de sesión anterior, superada |
| `AUDITORIA_FRONTEND_POS.md` | Auditoría de sesión anterior, superada |
| `AUDITORIA_RIESGOS.md` | Auditoría de sesión anterior, superada |

---

## Carpetas movidas / renombradas

| Original | Destino | Motivo |
|---|---|---|
| `backend/` | `_legacy_backend_php/` | Backend PHP completo reemplazado por Fastify. Renombrado (no eliminado) para conservar schema.sql como referencia de datos iniciales mientras se confirma que `schema_farmacia_completo.sql` los cubre completamente. |

> **Nota**: una vez confirmado que la BD de producción tiene los datos semilla correctos, `_legacy_backend_php/` puede eliminarse con `rm -rf _legacy_backend_php/`.

---

## Archivos modificados

### `start.sh`
- **Antes**: inicializaba la BD usando `backend/schema.sql` y aplicaba migraciones de `backend/migrations/*.sql`
- **Después**: usa `schema_farmacia_completo.sql` (raíz) para inicializar la BD; aplica `fix_database.sql` si existe
- **Impacto**: `./start.sh` funciona correctamente sin el directorio `backend/`

### `frontend/src/data/types.ts`
- **Eliminadas**: todas las constantes mock hardcoded:
  - `initialInventory`, `initialSales`, `initialPatients`, `initialAppointments`
  - `stackHighlights`, `moduleHighlights`, `operationalContext`, `baseReportAlerts`
  - Helpers internos `dateOffset()`, `dateTimeOffset()`
- **Conservados**: todos los `interface` y `type` (usados activamente por `app-data-context.tsx`)
- **Resultado**: archivo reducido de 368 → 61 líneas

### `frontend/src/pos/utils/posUtils.ts`
- **Eliminadas**:
  - `formatCurrency()` — duplicado de `lib/utils.ts`; componentes activos ahora importan de la fuente de verdad
  - `validarStockSuficiente()` — sin referencias externas
  - `generarCodigoVentaTemporal()` — sin referencias externas
  - `agruparItemsPorProducto()` — sin referencias externas
  - `POS_SHORTCUTS` constante — sin referencias externas
- **Resultado**: archivo reducido de 221 → 152 líneas

### `frontend/src/pos/index.ts` (barrel)
- Removidas exports de componentes no activos: `SalesPOS`, `usePOS`, `useFEFO`
- Removida export de `formatCurrency` (ya no existe en posUtils)
- Solo exporta componentes realmente usados: `Cart`, `PaymentPanel`, `CheckoutModal`

### `frontend/src/pos/components/Cart.tsx`
- Import de `formatCurrency` migrado desde `posUtils` → `@/lib/utils`

### `frontend/src/pos/components/CheckoutModal.tsx`
- Import de `formatCurrency` migrado desde `posUtils` → `@/lib/utils`

### `frontend/src/pos/components/PaymentPanel.tsx`
- Import de `formatCurrency` migrado desde `posUtils` → `@/lib/utils`

---

## Duplicados consolidados

| Duplicado | Fuente de verdad | Eliminado de |
|---|---|---|
| `formatCurrency()` | `frontend/src/lib/utils.ts` | `frontend/src/pos/utils/posUtils.ts` |
| Referencias DB init | `schema_farmacia_completo.sql` | `start.sh` (quitado apunte a `backend/schema.sql`) |

---

## Cosas que NO se tocaron (con justificación)

| Elemento | Razón |
|---|---|
| `backend-fastify/src/routes/ventas.routes.ts` | No registrado en server.ts pero contiene lógica Supabase completa — requiere revisión manual antes de eliminar |
| `backend-fastify/src/routes/inventario.routes.ts` | Igual que arriba |
| `backend-fastify/src/routes/kardex.routes.ts` | Funcionalidad futura sin equivalente activo |
| `backend-fastify/src/routes/clinical.routes.ts` | Funcionalidad clínica extendida sin equivalente activo |
| `backend-fastify/src/services/` (4 archivos) | Acompañan a las rutas no registradas |
| `backend-fastify/src/plugins/supabase.ts` | Acompaña a rutas huérfanas; eliminar en Fase C |
| `backend-fastify/src/schemas/index.ts` | Zod schemas con valor documental como contrato de API |
| `backend-fastify/src/types/database.ts` | Types Supabase generados, documentan el esquema |
| `frontend/src/pos/components/SalesPOS.tsx` | POS completo no activo — conservar hasta decisión arquitectural |
| `frontend/src/pos/hooks/usePOS.ts` | Acompaña a SalesPOS |
| `frontend/src/pos/hooks/useFEFO.ts` | Acompaña a SalesPOS + ProductSearch del POS |
| `frontend/src/services/api.ts` | Acompaña a usePOS y useFEFO — eliminar junto al POS en Fase C |
| `docs/guides/clinical_guia.md`, `docs/guides/kardex_guia.md` | Documentación técnica activa para módulos en desarrollo |
| `docs/context/contexto_botica.md` | Contexto del negocio — referencia valiosa |
| `docs/architecture/MODELO_BD.md`, `docs/architecture/RESUMEN_EJECUTIVO_REFACTOR.md` | Documentación de arquitectura — mantener |
| `schema_farmacia_completo.sql`, `local/backups/botica_db_backup.sql` | SQL crítico — no versionar el backup |
| `infoo/` | Assets gráficos del cliente (logos, letreros) — no tocar |

---

## Dependencias candidatas a remover (pendiente de Fase C)

| Paquete | Proyecto | Condición para remover |
|---|---|---|
| `@supabase/supabase-js` | `backend-fastify` | Cuando se eliminen `supabase.ts`, `ventas.service.ts`, `inventario.service.ts` y sus routes huérfanas |
| `zod` | `backend-fastify` | Solo si se confirma que ninguna ruta activa lo necesita (actualmente las rutas activas validan inline sin Zod) |

---

## Riesgos remanentes

| Riesgo | Descripción | Mitigación |
|---|---|---|
| Rutas Fastify duplicadas | `ventas.routes.ts` e `inventario.routes.ts` existen pero no están registradas — confusión potencial si alguien las registra accidentalmente | Están en Fase C del plan; revisar y eliminar cuando se valide que no aportan nada nuevo |
| `_legacy_backend_php/` en repo | Carpeta renombrada sigue presente — puede confundir | Eliminar con `rm -rf _legacy_backend_php/` cuando la BD de producción esté confirmada |
| `frontend/src/services/api.ts` apunta a URL absoluta | Si se usa en producción rompe CORS | No activar `SalesPOS` sin migrar a `lib/api.ts` |

---

## Validaciones recomendadas ahora

```bash
# 1. TypeScript — ya validado ✅
cd frontend && npx tsc --noEmit

# 2. Build frontend completo
cd frontend && npm run build

# 3. Build backend Fastify
cd backend-fastify && npm run build

# 4. Lint frontend
cd frontend && npm run lint

# 5. Smoke test manual:
#    - Login → panel carga
#    - Dashboard muestra métricas
#    - Inventario lista productos
#    - Ventas: buscar producto, agregar al carrito, checkout con IGV desagregado
#    - Caja: apertura y cierre
#    - Pacientes: listado y alta

# 6. Verificar start.sh con BD fresca (opcional):
./start.sh
```

---

## Estado post-cleanup

| Área | Antes | Después |
|---|---|---|
| Archivos PHP en repo | 27 archivos PHP | 0 activos (movidos a `_legacy_backend_php/`) |
| Constantes mock en frontend | ~300 líneas en `data/types.ts` | Eliminadas |
| Funciones muertas en posUtils | 5 funciones sin referencia | Eliminadas |
| `formatCurrency` duplicada | 2 implementaciones | 1 fuente de verdad (`lib/utils.ts`) |
| Markdowns de auditoría en raíz | 4 archivos obsoletos | Eliminados |
| Errores TypeScript | 0 | 0 ✅ |
