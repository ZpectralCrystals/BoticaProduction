# Informe QA E2E - Botica Local

Fecha: 2026-08-11T22:31:24.264Z
Run ID: E2E-20260811223124
Ambiente: local/lab
Frontend: http://localhost:5175
API: http://localhost:3001/api/v1
Backup previo: `/Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/local_e2e_audit_20260811223124.dump`

## Resumen

- PASS: 18
- FAIL: 2
- WARN: 0
- Resultado: CON OBSERVACIONES

## Alcance probado

Se ejecutó flujo real completo: login, caja, proveedor, producto, factura contado, factura crédito, almacenamiento por lote, venta FEFO, bloqueo por stock insuficiente, traslado entre almacenes, devolución de cliente, devolución a proveedor, ajuste de inventario, pago parcial de CXP, anulación de venta, movimiento manual de caja, módulos clínicos mínimos, endpoints de reportes/auditoría/consistencia.

## Casos

| # | Caso | Estado | Evidencia | Esperado |
|---:|---|---|---|---|
| 1 | Backup pre-QA | PASS | /Volumes/MAC/MAC Ext/Desktop/BoticaElPueblo-RebrandLab/backups/local_e2e_audit_20260811223124.dump | dump creado antes de tocar datos |
| 2 | Backend vivo | PASS | HTTP 200 | 200 OK |
| 3 | Login administrador | PASS | usuario=ADMINISTRADOR, rol=administrador | token válido |
| 4 | Sesión persistente API | PASS | dni=00000000 | 00000000 |
| 5 | Caja abierta | PASS | cajaId=1 existente | caja disponible para compras/ventas |
| 6 | Almacenes activos | PASS | venta=Botica – Disponible, destino=Botica – Cuarentena | origen vendible y destino distinto |
| 7 | Proveedor creado | PASS | proveedorId=12, ruc=20487484662 | proveedor activo |
| 8 | Producto creado | PASS | productoId=59, codigo=MED-059 | stock inicial 0 |
| 9 | Factura compra contado | PASS | compraId=52, total=52.5 | stock + caja egreso |
| 10 | Factura compra crédito | PASS | compraId=53, total=38.4 | stock + CXP |
| 11 | Stock almacenado tras facturas | PASS | stock=18, lotes=E2E-20260811223124-A:10:ACTIVO, E2E-20260811223124-B:8:ACTIVO | 18 unidades |
| 12 | CXP creada por factura crédito | PASS | cxpId=18, saldo=38.4, estado=PENDIENTE | saldo 38.40 pendiente |
| 13 | Venta FEFO registrada | PASS | ventaId=16, codigo=VTA-20260811-0016 | descuenta lote que vence antes |
| 14 | FEFO aplicado | PASS | stock=6, loteA=0/AGOTADO, loteB=6/ACTIVO | lote A agotado, lote B con 6 |
| 15 | Bloqueo venta sin stock | PASS | HTTP 400: STOCK INSUFICIENTE: Producto QA Flujo Completo E2E-20260811223124 tiene 6 unidad(es), se requieren 9999 | rechazo sin descontar stock |
| 16 | Traslado entre almacenes | PASS | origen=Botica – Disponible, destino=Botica – Cuarentena, cantidad=2 | producto stock total no cambia |
| 17 | Devolución cliente | PASS | productoId=59, cantidad=1 | stock +1 |
| 18 | Devolución proveedor | PASS | productoId=59, cantidad=1 | stock -1 |
| 19 | Ajuste inventario/kardex | FAIL | productoId=59, cantidad=1 | stock +1 con kardex |
| 20 | Ejecución general | FAIL | Ajuste inventario/kardex: productoId=59, cantidad=1 |  |

## Datos creados

| Entidad | ID / valor |
|---|---|
| userId | 1 |
| cajaId | 1 |
| providerId | 12 |
| productId | 59 |
| purchaseContadoId | 52 |
| purchaseCreditoId | 53 |
| cxpId | 18 |
| saleId | 16 |

## Estado final producto QA

- Stock producto: N/D
- Lotes: N/D
- Movimientos Kardex consultados: N/D

## Observaciones tester

Hay fallas en casos marcados FAIL. Revisar evidencia antes de pasar cambios a nube/producción.

## Recomendación

Mantener este script como regresión local antes de mover cambios a producción. Si se cambia compras, ventas, lotes, caja o CXP, volver a ejecutar y guardar nuevo informe.

