# AUDITORÍA FINAL DEL SISTEMA — Botica El Pueblo ERP
**Fecha:** Abril 2026  
**Tipo:** Auditoría técnica pre-producción  
**Alcance:** Backend Fastify + Frontend React + Base de datos PostgreSQL

---

## 🏆 SCORE GENERAL: **6.2 / 10**

> Sistema funcional para operación básica de botica. Tiene todos los módulos
> esenciales y la arquitectura es correcta. Faltan controles críticos de
> integridad (Kardex, FEFO) y algunos controles de seguridad antes de ser
> apto para producción sin supervisión técnica.

---

## ESTADO POR ÁREA

| Área | Score | Estado |
|---|---|---|
| Backend — Estructura | 8/10 | ✅ Sólido |
| Backend — Ventas (POS) | 7/10 | ✅ Corregido esta sesión |
| Backend — Seguridad | 5/10 | ⚠️ Faltantes importantes |
| Backend — Integridad BD | 4/10 | ❌ Sin Kardex/FEFO |
| Frontend — POS | 7.5/10 | ✅ Funcional |
| Frontend — Calidad código | 8/10 | ✅ Build limpio |
| Base de datos — Schema activo | 5/10 | ⚠️ Limitado, sin lotes |
| Operación / DevOps | 3/10 | ❌ Sin backup, monitoreo, migraciones |

---

## QUÉ ESTÁ LISTO ✅

### Backend
1. **Servidor Fastify** completamente funcional con 21 grupos de rutas registradas.
2. **Autenticación JWT** con cookie httpOnly + bcrypt — correcta.
3. **Transacciones atómicas** en ventas, compras y transferencias: BEGIN/COMMIT/ROLLBACK explícito.
4. **Validación de stock + bloqueo pesimista** (`SELECT FOR UPDATE`) en ventas — **corregido esta sesión**; el stock no puede quedar negativo en ventas concurrentes.
5. **Deducción de stock** en venta — **corregido esta sesión**; antes no se descontaba nada.
6. **Rechazo de producto vencido** en venta — **añadido esta sesión**.
7. **Registro de auditoría** en `bot_auditoria` para ventas y compras.
8. **Reabastecimiento de stock** en compras.
9. **Dashboard** con métricas del día (ventas, alertas, stock bajo, vencimientos próximos).

### Frontend
10. **SalesPOS** como componente POS oficial — reemplaza 642 líneas de código legacy.
11. **Búsqueda de productos en tiempo real** con debounce 300ms contra `/api/v1/inventario/search`.
12. **Carrito completo** con +/-, eliminar, limpiar.
13. **Cálculo de IGV** correcto (precios IGV-incluidos, 18%).
14. **PaymentPanel** con Efectivo/Yape/Mixto y cálculo de vuelto.
15. **CheckoutModal** con resumen tributario detallado.
16. **Alertas visuales**: stock bajo (≤5), vencimiento próximo (≤30 días), receta requerida.
17. **API unificada** — todo pasa por `lib/api.ts`, sin código Supabase.
18. **Build limpio** — `tsc` sin errores, `vite build` exitoso.

---

## QUÉ NO ESTÁ LISTO ❌

### Crítico para producción farmacéutica

#### 1. Sin Kardex de movimientos
**Impacto:** No hay registro histórico de movimientos de stock (entradas, salidas, ajustes).
Regulatoriamente en Perú, DIGEMID requiere que una farmacia pueda demostrar la
trazabilidad de sus medicamentos. Sin Kardex esto no es posible.

**Solución requerida:** Crear tabla `bot_kardex` y triggers para registrar cada
movimiento de `nstock` (ventas, compras, transferencias, ajustes).

#### 2. Sin FEFO (First Expired, First Out)
**Impacto:** El sistema vende del stock total del producto sin identificar qué
lote se está despachando. Medicamentos con vencimiento anterior podrían no
rotarse correctamente.

**Solución requerida:** Crear tabla `bot_lotes` y lógica de selección automática
del lote que vence primero al momento de la venta.

#### 3. Sin constraint `CHECK (nstock >= 0)` en BD
**Impacto:** Si existe un bug a nivel de código que bypasee la validación, la BD
lo permitiría. La garantía actual es solo a nivel aplicación.

**Solución inmediata:** `ALTER TABLE bot_productos ADD CONSTRAINT nstock_no_negativo CHECK (nstock >= 0);`

#### 4. JWT_SECRET no forzado
**Impacto:** Si se olvida setear la variable de entorno, el servidor arranca con
`'botica-fastify-local-secret'` — cualquier persona puede generar tokens válidos
sabiendo el secreto.

**Solución inmediata:**
```typescript
// En server.ts o al registrar jwt plugin:
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET env var is required in production')
}
```

#### 5. Sin rate limiting en login
**Impacto:** Ataque de fuerza bruta en `/api/v1/auth/login` sin restricción.

**Solución:** Instalar `@fastify/rate-limit` y aplicar a la ruta de login.

### Importante pero no bloqueante inmediato

#### 6. Sin anulación de ventas por interfaz
El campo `cestado` en `bot_ventas` admite `'A'`/`'I'` pero no hay ruta
`DELETE /ventas/:id` ni `PATCH /ventas/:id/anular` implementada.

#### 7. Cashier hardcodeado en frontend
`usePOS.submitVenta()` envía siempre `cashier: 'Caja principal'` sin leer el
usuario autenticado del contexto. Debería usar `useAuth().user.nombre`.

#### 8. Sin tests automatizados
Sin Vitest (unit) ni Playwright (e2e) — todo el testing es manual.

#### 9. Bundle frontend monolítico
Un solo chunk de 555 kB. En conexiones lentas (botica con internet limitado)
puede afectar la carga inicial.

---

## SIMULACIONES DE ESCENARIOS CRÍTICOS

### Venta simple (1 producto, stock disponible)
**Estado:** ✅ Funciona correctamente tras correcciones de esta sesión.
- Busca producto, agrega al carrito, confirma checkout.
- Backend: BEGIN → INSERT bot_ventas → SELECT FOR UPDATE bot_productos → valida stock → INSERT bot_ventas_det → UPDATE nstock → INSERT bot_auditoria → COMMIT.

### Venta con múltiples productos
**Estado:** ✅ Funciona. El loop itera por cada item aplicando FOR UPDATE individualmente.
- **Riesgo residual:** Si el item A pasa validación pero el item B falla, el ROLLBACK revierte todo correctamente.

### Producto sin stock
**Estado:** ✅ Bloqueado en frontend (botón deshabilitado) y en backend (HTTP 400 con mensaje claro).

### Producto vencido
**Estado:** ✅ Bloqueado en backend (HTTP 400 con mensaje claro) — **corregido esta sesión**.
- Frontend muestra badge de alerta pero no impedía el checkout.

### Venta concurrente (2 vendedores, 1 unidad)
**Estado:** ✅ `SELECT FOR UPDATE` garantiza que solo 1 transacción obtenga el lock.
La segunda recibirá `STOCK INSUFICIENTE` y hará ROLLBACK.

### Fraccionamiento (vender 1/2 blister)
**Estado:** ❌ No implementado. Solo vende unidades completas.

### Lote vencido (FEFO)
**Estado:** ❌ No existe tabla de lotes. El campo `tvencimien` en `bot_productos` es un solo valor por producto, no por lote.

---

## RIESGOS IDENTIFICADOS

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | JWT_SECRET en default en producción | Media | **Crítico** | Forzar env var o lanzar excepción |
| R2 | Stock negativo por bug futuro | Baja | **Alto** | Agregar CHECK constraint en BD |
| R3 | Brute force en login | Media | **Alto** | Rate limiting |
| R4 | Sin Kardex: auditoría DIGEMID imposible | Alta | **Alto** | Implementar bot_kardex |
| R5 | Venta de lote vencido sin FEFO | Media | **Alto** | El check de `tvencimien` mitiga parcialmente |
| R6 | Cookie sin `secure` en HTTP | Baja | Medio | Corregido (NODE_ENV=production) |
| R7 | Bundle lento en conexión pobre | Media | Bajo | Code splitting futuro |
| R8 | Sin backup automático BD | Alta | **Crítico** | pg_dump cron |

---

## RECOMENDACIONES POR PRIORIDAD

### ANTES de ir a producción (bloqueantes):
1. Setear `JWT_SECRET` fuerte en variables de entorno del servidor.
2. Agregar `CHECK (nstock >= 0)` en `bot_productos`.
3. Configurar HTTPS en el servidor (Nginx/Caddy + Let's Encrypt).
4. Configurar backup diario automático con `pg_dump`.

### PRIMERA SEMANA de operación:
5. Implementar `bot_kardex` con triggers para trazabilidad.
6. Agregar rate limiting en `/auth/login` (`@fastify/rate-limit`).
7. Arreglar `cashier` en `usePOS` para leer del contexto de autenticación.
8. Agregar ruta de anulación de ventas.

### PRIMERA QUINCENA:
9. Implementar `bot_lotes` y lógica FEFO.
10. Tests automatizados básicos (Vitest para hooks, Playwright para flujo de venta).
11. Monitoreo básico (al menos un script que alerte si el servidor cae).

---

## ARQUITECTURA — EVALUACIÓN

```
┌─────────────────────────────────────────────┐
│  Frontend React + Vite + Tailwind           │
│  SalesPOS ← usePOS ← lib/api.ts            │  ✅ Limpio
└───────────────────┬─────────────────────────┘
                    │ HTTP/JSON + JWT Cookie
┌───────────────────▼─────────────────────────┐
│  Fastify 5 + @fastify/jwt + pg              │
│  21 rutas bajo /api/v1                      │  ✅ Sólido
│  Transacciones con client.connect()         │
└───────────────────┬─────────────────────────┘
                    │ pg.Pool
┌───────────────────▼─────────────────────────┐
│  PostgreSQL — tablas bot_*                  │
│  (schema legacy, sin lotes ni kardex)       │  ⚠️ Limitado
└─────────────────────────────────────────────┘
```

La arquitectura es correcta y mantenible. El gap principal es que la base de datos
usa el schema antiguo `bot_*` y el schema completo `schema_farmacia_completo.sql`
(con lotes, kardex, FEFO) nunca fue aplicado.
