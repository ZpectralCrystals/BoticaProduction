# P1 - Permisos financieros backend CXP y reportes

Fecha: 2026-05-13

## 1. Resumen

Se cerro P1 de auditoria: CXP y reportes ya no quedan protegidos solo por login.

Regla final aplicada:

- Admin/super conserva acceso total.
- Usuario sin permiso recibe `403`.
- CXP lectura requiere `cxp_ver`.
- CXP pago requiere `cxp_pagar`.
- Reportes generales requieren `reportes_ver` o `reportes_financieros`.
- Reportes financieros requieren `reportes_financieros`.

Mensaje estandar:

```txt
No tienes permiso para realizar esta acción.
```

## 2. Problema corregido

Auditoria detecto:

- `backend-fastify/src/routes/cxp.routes.ts` usaba solo `requireAuth`.
- `backend-fastify/src/routes/reports.routes.ts` usaba solo `requireAuth`.

Riesgo:

- Cualquier usuario ERP activo podia consultar CXP si conocia endpoint.
- Cualquier usuario ERP activo podia ver reportes si conocia endpoint.
- Frontend ocultaba opciones, pero backend no era autoridad suficiente.

## 3. Permisos aplicados

| Modulo | Endpoint | Permiso requerido | Admin/super |
|---|---|---|---|
| CXP | `GET /api/v1/cuentas-por-pagar` | `cxp_ver` | OK |
| CXP | `GET /api/v1/cuentas-por-pagar/resumen` | `cxp_ver` | OK |
| CXP | `GET /api/v1/cuentas-por-pagar/:id` | `cxp_ver` | OK |
| CXP | `POST /api/v1/cuentas-por-pagar/:id/pagar` | `cxp_pagar` | OK |
| Reportes | `GET /api/v1/reportes?tipo=vencimiento` | `reportes_ver` o `reportes_financieros` | OK |
| Reportes | `GET /api/v1/reportes?tipo=faltantes` | `reportes_ver` o `reportes_financieros` | OK |
| Reportes | `GET /api/v1/reportes?tipo=rotacion` | `reportes_ver` o `reportes_financieros` | OK |
| Reportes | `GET /api/v1/reportes?tipo=utilidad-ventas` | `reportes_financieros` | OK |
| Reportes | `GET /api/v1/reportes?tipo=ganancias` | `reportes_financieros` | OK |
| Reportes | `GET /api/v1/reportes?tipo=perdidas` | `reportes_financieros` | OK |

## 4. Backend

Archivos modificados:

- `backend-fastify/src/routes/cxp.routes.ts`
- `backend-fastify/src/routes/reports.routes.ts`

### CXP

Se agregaron constantes:

```ts
const PERMISSION_ERROR = 'No tienes permiso para realizar esta acción.'
const CXP_READ_PERMISSIONS = ['cxp_ver']
const CXP_PAY_PERMISSIONS = ['cxp_pagar']
```

Se agrego helper local:

```ts
fastify.requireAnyPermission(request, reply, permissions, {
  errorMessage: PERMISSION_ERROR,
})
```

Rutas protegidas:

- Listado.
- Resumen.
- Detalle.
- Pago.

### Reportes

Se agregaron constantes:

```ts
const PERMISSION_ERROR = 'No tienes permiso para realizar esta acción.'
const REPORT_READ_PERMISSIONS = ['reportes_ver', 'reportes_financieros']
const REPORT_FINANCIAL_PERMISSIONS = ['reportes_financieros']
const FINANCIAL_REPORT_TYPES = new Set(['utilidad-ventas', 'ganancias', 'perdidas'])
```

Regla:

```ts
const requiredPermissions = FINANCIAL_REPORT_TYPES.has(tipo)
  ? REPORT_FINANCIAL_PERMISSIONS
  : REPORT_READ_PERMISSIONS
```

## 5. Tests

Archivos modificados:

- `backend-fastify/src/__tests__/cxp.test.ts`
- `backend-fastify/src/__tests__/reports.test.ts`

### CXP

Tests agregados:

- Pago CXP sin `cxp_pagar` devuelve `403`.
- Listado CXP sin `cxp_ver` devuelve `403`.
- Listado CXP con `cxp_ver` devuelve `200`.
- Detalle CXP sin `cxp_ver` devuelve `403`.

Validacion extra:

- En rechazos `403`, no se ejecutan queries DB de negocio.

### Reportes

Tests agregados:

- Reporte financiero con solo `reportes_ver` devuelve `403`.
- Reporte financiero con `reportes_financieros` devuelve `200`.
- Reporte no financiero sin `reportes_ver` devuelve `403`.
- Reporte no financiero con `reportes_ver` devuelve `200`.

## 6. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
cd backend-fastify && npx vitest run src/__tests__/cxp.test.ts src/__tests__/reports.test.ts
cd backend-fastify && npm test
cd backend-fastify && npm run build
cd backend-fastify && npm run lint

git diff --check
graphify update .
```

Resultado:

- Backend TypeScript OK.
- Tests enfocados OK: 2 archivos, 11 tests.
- Backend suite OK: 15 archivos, 123 tests.
- Backend build OK.
- Backend lint OK.
- `git diff --check` OK.
- Graphify actualizado.

## 7. Archivos modificados

- `backend-fastify/src/routes/cxp.routes.ts`
- `backend-fastify/src/routes/reports.routes.ts`
- `backend-fastify/src/__tests__/cxp.test.ts`
- `backend-fastify/src/__tests__/reports.test.ts`
- `BOTICA_P1_PERMISOS_FINANCIEROS_BACKEND.md`

## 8. Migraciones

No hubo migraciones.

No se tocaron tablas, columnas ni datos.

## 9. Alcance no tocado

No se modifico:

- Caja.
- Compras.
- FEFO.
- POS.
- Layout.
- Productos.
- CXP logica de pago, fuera de permisos.
- Reportes logica de calculo, fuera de permisos.
- Clerk.

## 10. Criterio de aceptacion

Cumplido:

- CXP no queda protegido solo por login.
- Reportes no quedan protegidos solo por login.
- Admin/super conserva acceso.
- Usuario sin permiso recibe `403`.
- Mensaje esperado aplicado.
- Tests cubren lectura/pago CXP y reportes generales/financieros.

