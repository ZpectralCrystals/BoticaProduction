# Cierre funcional de programación - 2026-08-18

## Veredicto

Sistema funcionalmente cerrado para operación interna de botica.

Producción: <https://botica-production.vercel.app>

Este cierre cubre código, base de datos, transacciones, validaciones y pruebas. No
incluye decisiones operativas del negocio ni integraciones externas.

## Alcance completado

| Flujo | Resultado |
|---|---|
| Compra al contado | Caja obligatoria, egreso, stock, lote, Kardex y auditoría |
| Compra al crédito | Stock, lote, Kardex, CXP y auditoría |
| Factura de compra | Índice único por proveedor/tipo/número; duplicado HTTP 409 |
| Venta | Caja asignada, precios permitidos, total/subtotales verificados |
| FEFO multi-lote | Descuento por vencimiento y almacén con bloqueo transaccional |
| Pago mixto | Efectivo, digital y vuelto persistidos |
| Anulación de venta | Restaura producto, lotes, almacén y Kardex |
| Caja | Anuladas excluidas; cierre usa ventas activas y movimientos válidos |
| Consistencia | Stock/lotes y Kardex auditables; productos sin lote protegidos |
| Seguridad | JWT, permisos, bcrypt, secretos fuera de Git |

## Correcciones de cierre

1. Kardex FEFO usa saldo global secuencial del producto, no saldo aislado del lote.
2. Anulación FEFO restaura saldos globales en orden auditable.
3. Reconciliación alinea Kardex histórico con movimiento de cantidad cero.
4. Productos `lrequiere_lote = false` quedan fuera de reconciliación por lotes.
5. Backend rechaza venta vacía, cantidad inválida, subtotal alterado, total alterado
   y producto duplicado en detalle.
6. Caja diaria excluye ventas anuladas.
7. Compra rechaza cantidades fraccionarias y facturas duplicadas.
8. Prueba React del POS termina sin advertencias `act(...)`.

## Base productiva

- Plataforma: Supabase Free, PostgreSQL 17.
- Backup previo: verificado con `gzip -t`, 128 KB.
- Duplicados de factura antes del índice: `0`.
- Índice `uq_bot_compras_proveedor_comprobante`: aplicado.
- Productos activos: `64`.
- Reconciliación aplicada: `5` Kardex alineados.
- Stock modificado por reconciliación: `0` productos.

Estado posterior:

| Verificación | Inconsistencias |
|---|---:|
| Stock vs lotes | 0 |
| Stock sin lotes requeridos | 0 |
| Lotes vencidos activos | 0 |
| Lotes sin almacén | 0 |
| Kardex vs stock | 0 |
| Kardex negativo | 0 |

Resultado general: `OK`.

## Validación técnica

- Backend: `141/141` pruebas, lint y build OK.
- Frontend: `56/56` pruebas, lint y build OK.
- Vercel: despliegue commit `ccd1757` exitoso.
- `/api/health`: HTTP 200, DB conectada.
- Login JWT: OK.
- Inventario protegido: OK.
- Guardia de total de venta: HTTP 400 ante diferencia.
- Auditorías npm productivas previas: 0 vulnerabilidades.

Advertencia no bloqueante: bundle frontend principal supera 500 KB. Code splitting
queda como optimización futura porque no afecta corrección funcional.

## Documentación

Raíz reducida a:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`

Auditorías, contexto e historial fueron movidos sin pérdida a `docs/audits/`,
`docs/context/` y `docs/reports/phases/`.

## Fuera de fase

- SUNAT para RUC/DNI: fase futura.
- Clerk completo: fase futura; JWT sigue oficial y funcional.
- Migración total a Drizzle: mejora interna futura, no bloqueante.
- Backups administrados, monitoreo y logs externos: fase operativa futura.
- Rotación de credenciales y definición de perfiles reales: tarea de entrega, no
  defecto de programación.

Supabase Free permanece como plataforma acordada. El sistema no depende de una
característica pagada para los flujos cerrados en este informe.
