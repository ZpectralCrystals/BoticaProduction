# BOTICA FASE 11 - Preparacion de commits

## 1. Resumen

Se reviso worktree y se preparo orden recomendado de commits por bloque funcional.

No se cambio logica de negocio.
No se hizo `git add`.
No se hizo commit.

## 2. Estado actual

Comandos ejecutados:

```bash
git status --short
git diff --stat
git diff --name-status
git ls-files --others --exclude-standard | sort
```

Resultado:

- 45 archivos tracked modificados.
- 39 archivos untracked relevantes.
- `git diff --stat`: 4917 insertions, 468 deletions en tracked.
- Untracked no aparece en `git diff --stat`.

## 3. Riesgo principal

Los cambios cruzan muchas fases y algunos archivos mezclan mas de un bloque:

- `frontend/src/lib/api.ts`
- `frontend/src/pages/inventory-page.tsx`
- `frontend/src/pages/caja-page.tsx`
- `backend-fastify/src/db/schema.ts`
- `backend-fastify/src/lib/schema-check.ts`
- `start.sh`

Recomendacion: commits por bloque grande, no por fase exacta, para evitar staging parcial fragil.

## 4. Orden recomendado de commits

### Commit 1 - docs: documentar fases y contexto botica

Archivos:

```bash
git add \
  AGENTS.md \
  README.md \
  BOTICA_AUDITORIA_FINAL_FLUJOS.md \
  BOTICA_FASE0_BASELINE_ESTADO_ACTUAL.md \
  BOTICA_FASE1_CAJA_OBLIGATORIA_VENTAS.md \
  BOTICA_FASE2_CAJA_ANULACION_ADMIN_CAJERO.md \
  BOTICA_FASE3_HISTORIAL_PRECIOS_UI.md \
  BOTICA_FASE4_CIERRE_CAJA_PERSISTENTE.md \
  BOTICA_FASE5_UTILIDAD_VENTAS.md \
  BOTICA_FASE6_PRODUCTOS_NO_MEDICAMENTOSOS.md \
  BOTICA_FASE7_LIMPIEZA_TECNICA_CONTROLADA.md \
  BOTICA_FASE8_VALIDACION_FUNCIONAL_LOCAL.md \
  BOTICA_FASE9_BOOTSTRAP_MIGRACIONES.md \
  BOTICA_FASE10_BASELINE_SQL_CANONICO.md \
  BOTICA_FASE11_PREPARACION_COMMITS.md \
  BOTICA_LAYOUT_FULL_WIDTH.md \
  BOTICA_LOTES_VENTAS_CAJA_AUDITORIA.md \
  CONTEXTO_ACTUAL_PROYECTO.md \
  CONTEXTO_PARA_CONTINUAR_DESARROLLO.md \
  RADIOGRAFIA_COMPLETA_BOTICA_EL_PUEBLO.md
```

Mensaje:

```txt
docs: documentar fases botica
```

### Commit 2 - chore: configurar tooling local y limpieza

Archivos:

```bash
git add \
  .gitignore \
  .codex/hooks.json \
  graphify-service.sh \
  backend-fastify/eslint.config.js \
  backend-fastify/package.json \
  backend-fastify/package-lock.json \
  mcp-server/mcp_config.json \
  mcp-server/package.json \
  mcp-server/package-lock.json \
  mcp-server/run.sh
```

Mensaje:

```txt
chore: ordenar tooling local
```

### Commit 3 - db: agregar migraciones y baseline canonico

Archivos:

```bash
git add \
  start.sh \
  ops/baseline/schema_botica_actual.sql \
  ops/migrations/008_rename_sales_clinical_customer_link.sql \
  ops/migrations/015_productos_precios_venta.sql \
  ops/migrations/016_productos_familias_categorias.sql \
  ops/migrations/017_productos_componentes.sql \
  ops/migrations/018_lotes_costo_y_producto_flags.sql \
  ops/migrations/019_producto_precios_y_historial.sql \
  ops/migrations/020_caja_movimientos_y_cxp.sql \
  ops/migrations/021_cierre_caja_persistente.sql \
  ops/migrations/022_productos_tipo_no_medicamento.sql
```

Mensaje:

```txt
db: agregar baseline y migraciones botica
```

### Commit 4 - feat: cerrar flujos backend botica

Archivos:

```bash
git add \
  backend-fastify/src/db/schema.ts \
  backend-fastify/src/lib/schema-check.ts \
  backend-fastify/src/server.ts \
  backend-fastify/src/routes/ajustes.routes.ts \
  backend-fastify/src/routes/caja.routes.ts \
  backend-fastify/src/routes/cxp.routes.ts \
  backend-fastify/src/routes/inventory.routes.ts \
  backend-fastify/src/routes/purchases.routes.ts \
  backend-fastify/src/routes/reports.routes.ts \
  backend-fastify/src/routes/sales.routes.ts \
  backend-fastify/src/routes/users.routes.ts \
  backend-fastify/src/__tests__/helpers/buildTestApp.ts \
  backend-fastify/src/__tests__/ajustes.test.ts \
  backend-fastify/src/__tests__/caja.test.ts \
  backend-fastify/src/__tests__/cxp.test.ts \
  backend-fastify/src/__tests__/inventory-prices.test.ts \
  backend-fastify/src/__tests__/purchases.test.ts \
  backend-fastify/src/__tests__/reports.test.ts \
  backend-fastify/src/__tests__/sales.test.ts \
  backend-fastify/src/__tests__/schema-check.test.ts \
  backend-fastify/src/__tests__/users.test.ts
```

Mensaje:

```txt
feat: cerrar flujos backend botica
```

### Commit 5 - feat: actualizar frontend POS e inventario

Archivos:

```bash
git add \
  frontend/src/lib/api.ts \
  frontend/src/app/router.tsx \
  frontend/src/components/layout/app-shell.tsx \
  frontend/src/components/shared/page-header.tsx \
  frontend/src/pages/ajustes-page.tsx \
  frontend/src/pages/caja-page.tsx \
  frontend/src/pages/compras-page.tsx \
  frontend/src/pages/compras-page.test.tsx \
  frontend/src/pages/cxp-page.tsx \
  frontend/src/pages/inventory-page.tsx \
  frontend/src/pages/reportes-page.tsx \
  frontend/src/pages/traslados-almacen-page.tsx \
  frontend/src/pos/components/Cart.tsx \
  frontend/src/pos/components/Cart.test.tsx \
  frontend/src/pos/components/PaymentPanel.tsx \
  frontend/src/pos/components/ProductSearch.tsx \
  frontend/src/pos/components/SalesPOS.tsx \
  frontend/src/pos/hooks/usePOS.ts \
  frontend/src/pos/hooks/usePOS.test.ts \
  frontend/src/pos/types/index.ts \
  frontend/src/pos/utils/posUtils.ts \
  frontend/src/pos/utils/posUtils.test.ts \
  frontend/vitest.config.ts
```

Mensaje:

```txt
feat: actualizar frontend botica
```

## 5. Checks antes de cada commit

Antes de commit 3:

```bash
bash -n start.sh
git diff --check
```

Antes de commit 4:

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint
```

Antes de commit 5:

```bash
cd frontend && npx tsc --noEmit
cd frontend && npm test
cd frontend && npm run build
cd frontend && npm run lint
```

Al final:

```bash
git status --short
```

## 6. Pendiente de decision

No se debe incluir `graphify-out/` en commits. Ya esta ignorado por `.gitignore`.

Revisar si `.codex/hooks.json` debe versionarse. Si es config local personal, mover fuera del commit 2 y mantener untracked/ignored.
