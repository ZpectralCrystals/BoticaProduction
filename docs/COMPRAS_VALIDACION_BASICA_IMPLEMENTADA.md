# COMPRAS VALIDACION BASICA IMPLEMENTADA

Fecha: 2026-04-12

## 1. Campos obligatorios

El flujo de compras quedó endurecido para exigir:

- `proveedorId`
- `tipoComprobante`
- `numeroDocumento`

Además, para registrar la compra:

- debe existir al menos un producto válido
- cada producto debe tener lote
- cada producto debe tener fecha de vencimiento

## 2. Tipo de comprobante permitido en esta fase

En esta fase solo se permite:

- `FACTURA`

Decisión aplicada:

- ya no se acepta texto libre para tipo de comprobante
- boleta no forma parte del flujo operativo actual
- liquidación de compra no se implementa todavía

Persistencia:

- `ctipo_comprobante`: tipo controlado de comprobante
- `cdocumento`: número de comprobante
- `nproveedor_id`: fuente de verdad del proveedor
- `cproveedor`: dato derivado para trazabilidad histórica

Migración agregada:

- `ops/migrations/011_compras_tipo_comprobante_factura.sql`

## 3. Validaciones frontend

Archivo principal:

- `frontend/src/pages/compras-page.tsx`

Validaciones aplicadas:

- no permite submit sin proveedor
- no permite submit sin tipo de comprobante
- no permite submit sin número de comprobante
- `FACTURA` queda como única opción válida en el formulario
- proveedor se selecciona desde lista, ya no como texto libre
- se muestran errores claros:
  - `Debe seleccionar un proveedor`
  - `Debe ingresar el número de comprobante`
  - `El tipo de comprobante es obligatorio`
  - `En esta fase solo se permite FACTURA`

## 4. Validaciones backend

Archivo principal:

- `backend-fastify/src/routes/purchases.routes.ts`

Validaciones aplicadas:

- si `proveedorId` no existe o es `<= 0` -> `400`
- si `tipoComprobante` está vacío -> `400`
- si `tipoComprobante !== 'FACTURA'` -> `400`
- si `numeroDocumento` está vacío -> `400`
- si el proveedor no existe o está inactivo -> `400`
- si no hay productos válidos -> `400`
- si cantidad <= 0 -> `400`
- si precio unitario < 0 -> `400`
- si falta lote o vencimiento por ítem -> `400`

Cobertura automática añadida:

- `backend-fastify/src/__tests__/purchases.test.ts`

## 5. Decisiones de negocio tomadas

- compras formales de proveedor en esta fase = solo `FACTURA`
- la fuente de verdad del proveedor es `proveedorId`
- el nombre del proveedor se mantiene como derivado en la cabecera por trazabilidad
- el número de comprobante se guarda separado del tipo
- se eliminó la ambigüedad de `documento` como texto libre

## 6. Pendiente futuro

Pendientes fuera de esta fase:

- boleta en compras, si el negocio decide soportarla
- liquidación de compra
- validaciones tributarias más avanzadas
- validación SUNAT
- reglas adicionales de numeración y series por proveedor

## 7. Integridad de negocio lograda

Con este cambio ya no se puede registrar:

- compra sin proveedor
- compra sin número de documento
- compra con comprobante inválido
- compra con proveedor inexistente

## 8. Preparación para validaciones duras de proveedores

Sí, el sistema ya quedó listo para aplicar validaciones duras a proveedores.

Impacto esperado en compras:

- el flujo de compras ya depende formalmente de `proveedorId`
- cuando se endurezca el módulo de proveedores, compras no necesitará rediseño
- el efecto principal será que la lista de proveedores seleccionables será más confiable y auditable
- si existen proveedores históricos incompletos, deberán regularizarse para evitar usarlos en nuevas compras
