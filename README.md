# Botica El Pueblo

ERP web para operación de botica: inventario, compras, ventas, caja, lotes,
vencimientos, Kardex, almacenes, proveedores, pacientes, usuarios y reportes.

## Estado

**Cierre funcional de programación:** completado el 18 de agosto de 2026.

- Producción: <https://botica-production.vercel.app>
- Frontend: React 19 + Vite 8 + TypeScript + Tailwind CSS 4
- Backend: Fastify 5 + TypeScript
- Base de datos: PostgreSQL 17 en Supabase Free
- Autenticación activa: JWT local con contraseñas bcrypt
- Despliegue: Vercel, frontend y API bajo el mismo dominio

El cierre funcional no depende de SUNAT, Clerk, servicios de monitoreo pagados ni
funciones avanzadas de Supabase. Esas integraciones pertenecen a fases futuras.

## Flujos cerrados

### Inventario

- Stock global sincronizado con lotes activos.
- Ingreso por compras y salida por ventas.
- FEFO por vencimiento y almacén vendible.
- Kardex con saldo global antes/después y trazabilidad por lote.
- Ajustes, traslados, devoluciones, cuarentena y baja.
- Validación de vencidos, stock negativo y diferencias de consistencia.
- Reconciliación auditable sin borrar historial.

### Compras

- Proveedor, almacén, factura y detalle obligatorios.
- Compra al contado requiere caja abierta y registra egreso.
- Compra al crédito crea cuenta por pagar.
- Actualiza producto, lote, almacén, Kardex y auditoría en una transacción.
- Comprobante único por proveedor y tipo; duplicados devuelven HTTP 409.

### Ventas

- Caja abierta obligatoria para el usuario asignado.
- Precio limitado a precios configurados del producto.
- Total y subtotales recalculados y validados por backend.
- Descuento FEFO multi-lote dentro de una transacción.
- Pagos en efectivo, digital y mixto con vuelto auditable.
- Anulación administrativa restaura producto, lotes, almacén y Kardex.
- Ventas anuladas quedan fuera de caja y métricas activas.

### Caja y seguridad

- Apertura por administrador y asignación a cajero.
- Cierre automático con ventas efectivas, ingresos, egresos y gastos.
- Permisos por módulo y acciones sensibles restringidas.
- Auditoría para compras, ventas, anulaciones, caja y reconciliaciones.
- Base Supabase accesible solo mediante backend; secretos fuera del repositorio.

## Verificación

```bash
cd backend-fastify
npm test
npm run lint
npm run build

cd ../frontend
npm test
npm run lint
npm run build
```

Cobertura de cierre:

- Backend: 141 pruebas.
- Frontend: 56 pruebas.
- Flujos críticos: compra, CXP, caja, venta, FEFO, anulación, Kardex,
  consistencia, precios, almacenes y permisos.

## Desarrollo local

```bash
./start.sh
```

Servicios predeterminados:

- Frontend: <http://localhost:5173>
- API: <http://127.0.0.1:3000/api/v1>
- Swagger: <http://127.0.0.1:3000/documentation>

Variables principales:

```env
BOTICA_DB_HOST=localhost
BOTICA_DB_PORT=5432
BOTICA_DB_NAME=botica_db
BOTICA_DB_USER=postgres
BOTICA_DB_PASS=secreto
BOTICA_DB_SSL=false
JWT_SECRET=secreto-aleatorio-de-al-menos-32-caracteres
CORS_ORIGIN=http://localhost:5173
```

No guardar `.env`, contraseñas, tokens ni cadenas de conexión en Git.

## Estructura

```text
api/                         Adaptador serverless para Vercel
frontend/                    Aplicación React/Vite
backend-fastify/             API Fastify y pruebas
supabase/migrations/         Migraciones canónicas de producción
ops/migrations/              Espejo operativo para instalaciones locales
scripts/                     Backup, smoke tests y auditorías
docs/architecture/           Arquitectura
docs/audits/                 Auditorías técnicas
docs/context/                Contexto y radiografías
docs/guides/                 Guías funcionales
docs/manuales/               Manual de usuario
docs/operations/             Operación y despliegue
docs/reports/                Estado y cierres
docs/reports/phases/         Historial de fases de implementación
```

`README.md`, `AGENTS.md` y `CLAUDE.md` permanecen en raíz porque herramientas y
personas los detectan allí. El resto de documentación está agrupado en `docs/`.

## Alcance futuro

No bloquea el cierre funcional actual:

- Integración SUNAT para consulta externa de RUC/DNI.
- Clerk como proveedor de identidad alternativo.
- Migración total de SQL directo a Drizzle ORM.
- Monitoreo y logs centralizados externos.
- Automatización administrada de backups; Supabase Free usa además backup manual.
- Rotación final de credenciales antes de entrega pública.

Ver estado detallado en
[`docs/reports/CIERRE_FUNCIONAL_PROGRAMACION_20260818.md`](docs/reports/CIERRE_FUNCIONAL_PROGRAMACION_20260818.md).
