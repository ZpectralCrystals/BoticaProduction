# VEREDICTO FINAL — ¿Listo para Producción?

---

## ❌ NO LISTO PARA PRODUCCIÓN AUTÓNOMA

### ✅ SÍ listo para operación supervisada / piloto controlado

---

## VEREDICTO DETALLADO

El sistema **puede usarse HOY en una botica real** bajo las siguientes condiciones:

1. Un técnico de sistemas está disponible para intervenir si ocurre un problema.
2. Se hace backup manual de la base de datos al inicio y fin de cada jornada.
3. Se acepta que no hay trazabilidad de lotes (sin Kardex, sin FEFO).
4. El servidor corre en red local (no expuesto a internet) mientras no tenga HTTPS.

**Lo que impide la producción autónoma plena** son 4 requisitos técnicos concretos:

---

## 🔴 BLOQUEANTES — Deben resolverse antes de producción sin supervisión

### BLQ-1: JWT_SECRET sin forzar
```
Estado actual:  JWT_SECRET || 'botica-fastify-local-secret'
Riesgo:         Cualquier persona puede firmar tokens válidos si conoce el fallback
Tiempo de fix:  15 minutos
```
**Fix:**
```typescript
// backend-fastify/src/server.ts — en start() antes de registerPlugins()
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET env var es obligatoria en producción')
}
```

### BLQ-2: Sin constraint CHECK en stock
```
Estado actual:  nstock puede quedar en negativo si hay un bug a nivel código
Riesgo:         Datos inconsistentes en BD — pérdida silenciosa de inventario
Tiempo de fix:  1 SQL
```
**Fix:**
```sql
ALTER TABLE bot_productos
  ADD CONSTRAINT nstock_no_negativo CHECK (nstock >= 0);
```

### BLQ-3: Sin HTTPS en producción
```
Estado actual:  Cookie secure=true en producción PERO si no hay HTTPS, el token
                viaja en claro por la red local o internet
Riesgo:         Captura de token por sniffing (especialmente en WiFi)
Tiempo de fix:  2-4 horas (Nginx + Let's Encrypt)
```

### BLQ-4: Sin backup automático de BD
```
Estado actual:  Sin ningún mecanismo de backup
Riesgo:         Pérdida total de datos ante falla de disco o corrupción
Tiempo de fix:  30 minutos (cron + pg_dump)
```
**Fix mínimo (cron en Linux):**
```bash
# /etc/cron.daily/botica-backup
0 2 * * * pg_dump botica_db | gzip > /backups/botica_$(date +\%Y\%m\%d).sql.gz
```

---

## 🟡 IMPORTANTES — Resolver en la primera semana de operación

### IMP-1: Kardex de movimientos
Sin registro histórico de movimientos de stock, es imposible:
- Auditar discrepancias
- Demostrar trazabilidad ante DIGEMID
- Detectar merma o robo

### IMP-2: Rate limiting en login
`POST /api/v1/auth/login` sin límite de intentos. Con 8 dígitos de DNI,
un atacante puede probar contraseñas ilimitadamente.

### IMP-3: Cashier hardcodeado
`usePOS` envía siempre `cashier: 'Caja principal'`. Las ventas no quedan
atribuidas al cajero correcto cuando hay múltiples usuarios.

### IMP-4: Sin anulación de ventas
No existe ruta para anular una venta errónea. El administrador debe
corregirlo directamente en la base de datos.

---

## 🟢 LO QUE YA FUNCIONA EN PRODUCCIÓN

| Funcionalidad | Estado |
|---|---|
| Login seguro (bcrypt + JWT) | ✅ |
| Sesión persistente 8 horas | ✅ |
| Búsqueda de productos en tiempo real | ✅ |
| Agregar/quitar productos del carrito | ✅ |
| Validación de stock antes de vender | ✅ |
| Bloqueo concurrente (2 ventas simultáneas, 1 unidad) | ✅ |
| Rechazo de productos vencidos | ✅ |
| Descuento correcto de stock al vender | ✅ |
| IGV 18% calculado server-side | ✅ |
| Pago en Efectivo / Yape / Mixto | ✅ |
| Cálculo de vuelto | ✅ |
| Código de venta único (VTA-YYYYMMDD-XXXX) | ✅ |
| Rollback completo si falla algún item | ✅ |
| Registro de auditoría por venta | ✅ |
| Reabastecimiento en compras | ✅ |
| Alertas de stock bajo y vencimiento (dashboard) | ✅ |
| Gestión de pacientes | ✅ |
| Gestión de proveedores | ✅ |
| Transferencias con validación de stock | ✅ |
| Historial de ventas del día | ✅ |
| Build frontend sin errores TypeScript | ✅ |

---

## PLAN DE ACCIÓN PARA PRODUCCIÓN PLENA

```
Semana 0 (HOY — antes de encender en producción):
  ├─ [2h]  Configurar variables de entorno: JWT_SECRET, DB credentials
  ├─ [1h]  Ejecutar SQL: CHECK constraint nstock >= 0
  ├─ [4h]  Configurar Nginx + HTTPS (Let's Encrypt o certificado propio)
  └─ [1h]  Script de backup diario (cron + pg_dump)

Semana 1 (operación supervisada):
  ├─ [4h]  Agregar @fastify/rate-limit en /auth/login
  ├─ [2h]  Leer cashier desde contexto de auth en usePOS
  ├─ [4h]  Ruta de anulación de ventas
  └─ [8h]  Tabla bot_kardex + triggers básicos

Semana 2-3 (optimización):
  ├─ [16h] Tabla bot_lotes + lógica FEFO
  ├─ [8h]  Tests automatizados básicos (Vitest)
  └─ [4h]  Code splitting del bundle frontend
```

**Esfuerzo total estimado para producción plena: ~55 horas de desarrollo**

---

## RESUMEN EJECUTIVO

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│   El sistema PUEDE OPERAR en una botica real HOY                  │
│   con supervisión técnica y los 4 fixes de BLQ-1 a BLQ-4.       │
│                                                                   │
│   Para producción autónoma y cumplimiento regulatorio            │
│   (DIGEMID), se requieren además: Kardex + FEFO + HTTPS.         │
│                                                                   │
│   Tiempo estimado para producción sin restricciones: 2-3 semanas │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

*Auditoría realizada sobre commit actual. Los fixes BLQ aplicados en esta sesión:*
- *`SELECT FOR UPDATE` + validación de stock en ventas*
- *Deducción de `nstock` al crear venta*
- *Rechazo de producto vencido en venta*
- *Cookie `secure` condicional por `NODE_ENV`*
- *Búsqueda duplicada en `/inventario/search` corregida*
