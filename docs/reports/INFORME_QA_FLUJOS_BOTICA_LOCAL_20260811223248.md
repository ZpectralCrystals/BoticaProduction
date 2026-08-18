# Informe QA E2E - Botica Local

Fecha: 2026-08-11T22:32:48.472Z
Run ID: E2E-20260811223248
Ambiente: local/lab
Frontend: http://localhost:5175
API: http://localhost:3001/api/v1
Backup previo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/local_e2e_audit_20260811223248.dump`

## Resumen

- PASS: 43
- FAIL: 0
- WARN: 0
- Resultado: APROBADO para pruebas operativas locales

## Alcance probado

Se ejecutó flujo real completo: login, caja, proveedor, producto, factura contado, factura crédito, almacenamiento por lote, venta FEFO, bloqueo por stock insuficiente, traslado entre almacenes, devolución de cliente, devolución a proveedor, ajuste de inventario, pago parcial de CXP, anulación de venta, movimiento manual de caja, módulos clínicos mínimos, endpoints de reportes/auditoría/consistencia.

## Casos

| # | Caso | Estado | Evidencia | Esperado |
|---:|---|---|---|---|
| 1 | Backup pre-QA | PASS | /Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/local_e2e_audit_20260811223248.dump | dump creado antes de tocar datos |
| 2 | Backend vivo | PASS | HTTP 200 | 200 OK |
| 3 | Login administrador | PASS | usuario=ADMINISTRADOR, rol=administrador | token válido |
| 4 | Sesión persistente API | PASS | dni=00000000 | 00000000 |
| 5 | Caja abierta | PASS | cajaId=1 existente | caja disponible para compras/ventas |
| 6 | Almacenes activos | PASS | venta=Botica – Disponible, destino=Botica – Cuarentena | origen vendible y destino distinto |
| 7 | Proveedor creado | PASS | proveedorId=14, ruc=20487568846 | proveedor activo |
| 8 | Producto creado | PASS | productoId=61, codigo=MED-061 | stock inicial 0 |
| 9 | Factura compra contado | PASS | compraId=56, total=52.5 | stock + caja egreso |
| 10 | Factura compra crédito | PASS | compraId=57, total=38.4 | stock + CXP |
| 11 | Stock almacenado tras facturas | PASS | stock=18, lotes=E2E-20260811223248-A:10:ACTIVO, E2E-20260811223248-B:8:ACTIVO | 18 unidades |
| 12 | CXP creada por factura crédito | PASS | cxpId=20, saldo=38.4, estado=PENDIENTE | saldo 38.40 pendiente |
| 13 | Venta FEFO registrada | PASS | ventaId=21, codigo=VTA-20260811-0021 | descuenta lote que vence antes |
| 14 | FEFO aplicado | PASS | stock=6, loteA=0/AGOTADO, loteB=6/ACTIVO | lote A agotado, lote B con 6 |
| 15 | Bloqueo venta sin stock | PASS | HTTP 400: STOCK INSUFICIENTE: Producto QA Flujo Completo E2E-20260811223248 tiene 6 unidad(es), se requieren 9999 | HTTP 400 sin descontar stock |
| 16 | Traslado entre almacenes | PASS | origen=Botica – Disponible, destino=Botica – Cuarentena, cantidad=2 | producto stock total no cambia |
| 17 | Devolución cliente | PASS | productoId=61, cantidad=1 | stock +1 |
| 18 | Devolución proveedor | PASS | productoId=61, cantidad=1 | stock -1 |
| 19 | Ajuste inventario/kardex | PASS | productoId=61, cantidad=1, kardexId=101 | stock +1 con kardex |
| 20 | Pago parcial CXP | PASS | pagoId=2, cajaMov=40 | saldo baja a 28.40 |
| 21 | CXP saldo actualizado | PASS | saldo=28.40, pagos=1 | saldo 28.40 |
| 22 | Anulación venta | PASS | ventaId=23, codigo=VTA-20260811-0023, message=Venta VTA-20260811-0023 anulada correctamente | stock/lote restaurado |
| 23 | Caja movimiento manual | PASS | movId=41 | ingreso registrado |
| 24 | Flujo clínico mínimo | PASS | paciente=6, medico=4, servicio=9, cita=7 | alta de entidades clínicas |
| 25 | API smoke /dashboard | PASS | HTTP 200 | 200 OK |
| 26 | API smoke /inventario | PASS | HTTP 200 | 200 OK |
| 27 | API smoke /compras | PASS | HTTP 200 | 200 OK |
| 28 | API smoke /ventas | PASS | HTTP 200 | 200 OK |
| 29 | API smoke /caja | PASS | HTTP 200 | 200 OK |
| 30 | API smoke /caja/resumen | PASS | HTTP 200 | 200 OK |
| 31 | API smoke /cuentas-por-pagar | PASS | HTTP 200 | 200 OK |
| 32 | API smoke /cuentas-por-pagar/resumen | PASS | HTTP 200 | 200 OK |
| 33 | API smoke /kardex | PASS | HTTP 200 | 200 OK |
| 34 | API smoke /lotes | PASS | HTTP 200 | 200 OK |
| 35 | API smoke /almacenes | PASS | HTTP 200 | 200 OK |
| 36 | API smoke /traslados-almacen | PASS | HTTP 200 | 200 OK |
| 37 | API smoke /consistencia/stock | PASS | HTTP 200 | 200 OK |
| 38 | API smoke /consistencia/lotes | PASS | HTTP 200 | 200 OK |
| 39 | API smoke /consistencia/kardex | PASS | HTTP 200 | 200 OK |
| 40 | API smoke /consistencia/resumen | PASS | HTTP 200 | 200 OK |
| 41 | API smoke /consistencia/alertas | PASS | HTTP 200 | 200 OK |
| 42 | API smoke /reportes?tipo=ganancias | PASS | HTTP 200 | 200 OK |
| 43 | API smoke /auditoria | PASS | HTTP 200 | 200 OK |

## Datos creados

| Entidad | ID / valor |
|---|---|
| userId | 1 |
| cajaId | 1 |
| providerId | 14 |
| productId | 61 |
| purchaseContadoId | 56 |
| purchaseCreditoId | 57 |
| cxpId | 20 |
| saleId | 21 |
| saleAnnulId | 23 |
| patientId | 6 |
| doctorId | 4 |
| serviceId | 9 |
| appointmentId | 7 |

## Estado final producto QA

- Stock producto: 7
- Lotes: DEV-1786487568913:1:ACTIVO, E2E-20260811223248-A:0:AGOTADO, E2E-20260811223248-B:3:ACTIVO, E2E-20260811223248-B:2:ACTIVO
- Movimientos Kardex consultados: 10

## Observaciones tester

No se encontraron bloqueos funcionales en flujo principal local. La trazabilidad compra → lote → venta FEFO → kardex → caja/CXP respondió correctamente.

## Recomendación

Mantener este script como regresión local antes de mover cambios a producción. Si se cambia compras, ventas, lotes, caja o CXP, volver a ejecutar y guardar nuevo informe.

