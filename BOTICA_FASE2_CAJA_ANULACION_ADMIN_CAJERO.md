# BOTICA_FASE2_CAJA_ANULACION_ADMIN_CAJERO.md

## 1. Resumen

Se implementó Fase 2 para caja:

- Anulación lógica de movimientos de caja.
- Reglas admin/cajero para apertura, asignación y cierre.
- Caja asignada a usuario vía `bot_caja.nusuario_id`.
- Venta sigue limitada a caja abierta asignada al usuario autenticado.

No se tocaron FEFO, lotes, compras, CXP, reportes no relacionados, layout, Clerk ni legacy PHP/Supabase.

## 2. Documentos leídos

- `BOTICA_FASE0_BASELINE_ESTADO_ACTUAL.md`
- `BOTICA_FASE1_CAJA_OBLIGATORIA_VENTAS.md`
- `BOTICA_AUDITORIA_FINAL_FLUJOS.md`
- `BOTICA_LOTES_VENTAS_CAJA_AUDITORIA.md`

## 3. Regla A — Anulación de movimientos de caja

Nuevo endpoint:

```txt
PATCH /api/v1/caja/movimientos/:id/anular
```

Payload:

```json
{
  "motivo": "Registro duplicado"
}
```

Resultado:

- No borra registros.
- Cambia `bot_caja_movimientos.cestado` de `A` a `N`.
- Guarda motivo, usuario y fecha en `cdescripcion` usando el espacio existente.
- Inserta auditoría con acción `ANULA_CAJA_MOVIMIENTO`.
- Resumen y cierre siguen usando solo `cestado = 'A'`, por tanto ignoran anulados.

Permisos:

- Admin/super puede anular cualquier movimiento.
- Usuario con permiso explícito `caja_anular` puede anular movimientos de su caja asignada.
- Usuario sin permiso recibe `403`.

## 4. Regla B — Caja admin/cajero

Flujo aplicado:

- Solo admin/super puede abrir caja.
- Admin puede asignar caja a un usuario con `usuarioId`.
- Si no manda `usuarioId`, se asigna al admin actual.
- Se valida que el usuario asignado exista y esté activo.
- No se permite abrir otra caja activa para el mismo usuario asignado.
- Cajero asignado puede vender porque Fase 1 valida `bot_caja.cestado = 'A' AND nusuario_id = usuario autenticado`.
- Cajero no puede cerrar caja salvo que tenga permiso explícito `caja_cierre`.
- Admin/super puede cerrar caja abierta.

Permisos explícitos nuevos usados por convención:

- `caja_cierre`
- `caja_anular`

No se creó migración para permisos; el sistema ya soporta permisos por `bot_permisos.cseccion`.

## 5. Cambios backend

### `backend-fastify/src/routes/caja.routes.ts`

- Helpers:
  - `canManageCaja`
  - `hasCajaPermission`
- `POST /api/v1/caja` con `action='abrir'`:
  - requiere admin/super.
  - acepta `usuarioId`.
  - guarda caja asignada en `bot_caja.nusuario_id`.
  - audita apertura con usuario asignado.
- `POST /api/v1/caja` con `action='cerrar'`:
  - requiere admin/super o `caja_cierre`.
  - admin puede cerrar caja abierta aunque esté asignada a otro usuario.
  - cajero con `caja_cierre` solo cierra su caja asignada.
  - cierre calcula ventas por usuario asignado a la caja.
- `GET /api/v1/caja/resumen`:
  - admin ve última caja abierta.
  - cajero ve su caja asignada.
  - ventas se calculan por usuario asignado.
  - movimientos anulados quedan excluidos por `cestado = 'A'`.
- `GET /api/v1/caja/movimientos`:
  - filtra movimientos activos.
  - admin puede ver última caja abierta o caja indicada.
  - cajero ve movimientos de su caja.
- `POST /api/v1/caja/movimientos`:
  - admin registra movimiento en última caja abierta.
  - cajero registra movimiento en su caja asignada.
- `PATCH /api/v1/caja/movimientos/:id/anular`:
  - anulación lógica + auditoría.

### `backend-fastify/src/__tests__/caja.test.ts`

Nuevo archivo con tests de:

- Admin abre caja y asigna usuario.
- Cajero sin admin no puede abrir caja.
- Cajero sin permiso no puede cerrar caja.
- Cajero con `caja_cierre` cierra su caja.
- Admin anula movimiento.
- Cajero sin permiso no puede anular movimiento.

## 6. Cambios frontend

### `frontend/src/lib/api.ts`

- `apiAbrirCaja(montoApertura, caja?, usuarioId?)`.
- `apiCerrarCaja(montoCierre, cajaId?)`.
- `apiAnularCajaMovimiento(id, motivo)`.
- `ApiCaja.cajaAbierta` ahora puede incluir `usuarioId` y `usuarioNombre`.
- `ApiCajaMovimiento` ahora puede incluir `estado`.

### `frontend/src/pages/caja-page.tsx`

- Pantalla de apertura permite seleccionar usuario asignado.
- Usa `apiGetUsuarios`; si usuario no es admin y API responde 403, el selector queda vacío.
- Caja abierta muestra usuario asignado cuando backend lo envía.
- Tabla de movimientos agrega acción para anular.
- Anulación pide motivo con prompt y refresca caja/resumen/movimientos.

## 7. Migraciones

No hubo migraciones.

Motivo: `bot_caja_movimientos` ya tiene:

- `cestado`
- `cdescripcion`
- `nusuario_id`
- `cusuario`
- `tcreado`

Para guardar anulación sin migrar:

- `cestado = 'N'`
- `cdescripcion` agrega motivo, usuario y fecha.
- `bot_auditoria` guarda detalle formal de anulación.

## 8. Endpoints revisados

- `GET /api/v1/caja`
- `POST /api/v1/caja`
- `GET /api/v1/caja/movimientos`
- `POST /api/v1/caja/movimientos`
- `PATCH /api/v1/caja/movimientos/:id/anular`
- `GET /api/v1/caja/resumen`
- `POST /api/v1/ventas`
- `POST /api/v1/cuentas-por-pagar/:id/pagar`

## 9. Validaciones ejecutadas

```bash
cd backend-fastify && npx tsc --noEmit
```

Resultado: OK.

```bash
cd backend-fastify && npm test
```

Resultado: OK. 12 archivos, 95 tests passed.

```bash
cd backend-fastify && npm run build
```

Resultado: OK.

```bash
cd backend-fastify && npm run lint
```

Resultado: OK.

```bash
cd frontend && npx tsc --noEmit
```

Resultado: OK.

```bash
cd frontend && npm test
```

Resultado: OK. 4 archivos, 50 tests passed. Persisten warnings previos de React `act(...)`; no bloquean.

```bash
cd frontend && npm run build
```

Resultado: OK. Vite mantiene warning de chunk mayor a 500 kB; no bloquea.

```bash
cd frontend && npm run lint
```

Resultado: OK.

## 10. Resultado final

- Movimientos de caja ahora se anulan, no se borran.
- Movimientos anulados no afectan resumen ni cierre.
- Admin abre caja y la asigna a usuario.
- Cajero asignado puede vender usando su caja.
- Cajero no cierra caja salvo permiso `caja_cierre`.
- Admin/super cierra caja.
- Admin/super o `caja_anular` anulan movimientos.
- Sin migraciones.

## 11. Riesgos / pendientes

- Anular un movimiento `PAGO_FACTURA` excluye caja, pero no revierte automáticamente el pago de CXP. Si se requiere reversión contable completa, conviene crear flujo específico de anulación de pago CXP.
- `caja_cierre` y `caja_anular` son permisos por convención; UI de usuarios permite permisos por módulo estándar, pero no agrega etiquetas especiales para estos dos permisos.
- Motivo/user/fecha de anulación se guardan en `cdescripcion` y `bot_auditoria` por no crear migración. Si se requiere auditoría estructurada, crear columnas dedicadas en fase futura.
