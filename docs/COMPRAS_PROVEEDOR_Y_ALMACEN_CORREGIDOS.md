# COMPRAS PROVEEDOR Y ALMACEN CORREGIDOS

Fecha: 2026-04-12

## 1. Qué cambió en el formulario

El formulario de compras quedó ajustado para trabajar como flujo ERP explícito:

- proveedor obligatorio desde catálogo
- almacén destino obligatorio desde catálogo
- tipo de comprobante fijo a `FACTURA`
- número de comprobante obligatorio
- sin texto libre para proveedor
- sin texto libre para almacén
- sin defaults invisibles para el almacén destino

## 2. Cómo se selecciona proveedor

Fuente:

- catálogo de proveedores activos desde backend

Comportamiento:

- se muestra razón social + RUC
- el valor persistido es `proveedorId`
- el nombre del proveedor queda como dato derivado para trazabilidad, pero no como fuente de verdad

Validación:

- si no se selecciona proveedor, la compra no se puede guardar

## 3. Cómo se selecciona almacén destino

Fuente:

- catálogo de almacenes activos desde backend

Comportamiento:

- se muestra `local + nombre de almacén + tipo`
- el valor persistido es `almacenId`
- ese almacén alimenta:
  - cabecera de compra
  - lotes creados
  - kardex
  - movimiento de almacén

Validación:

- si no se selecciona almacén destino, la compra no se puede guardar

## 4. Validaciones backend

Archivo principal:

- `backend-fastify/src/routes/purchases.routes.ts`

Validaciones activas:

- `proveedorId` obligatorio
- `proveedorId` debe existir y estar activo
- `almacenId` obligatorio
- `almacenId` debe existir y estar activo
- `tipoComprobante` obligatorio
- `tipoComprobante === 'FACTURA'`
- `numeroDocumento` obligatorio
- al menos un ítem válido
- cada ítem con producto, cantidad, precio unitario, lote y vencimiento

Mensajes clave:

- `Debe seleccionar un proveedor`
- `Debe seleccionar un almacén destino`
- `Debe ingresar el número de comprobante`
- `El tipo de comprobante es obligatorio`
- `En esta fase solo se permite FACTURA`
- `Proveedor no encontrado`
- `Almacén destino no encontrado o inactivo`

## 5. Persistencia final

La compra queda persistida con:

- `nproveedor_id`
- `nalmacen_id`
- `ctipo_comprobante`
- `cdocumento`

Reglas de asociación operativa:

- `bot_compras.nproveedor_id`: fuente de verdad del proveedor
- `bot_compras.nalmacen_id`: fuente de verdad del almacén destino de la compra
- `bot_lotes.nalmacen_id`: cada lote queda asociado al almacén seleccionado
- `bot_kardex.nalmacen_id`: el movimiento de compra queda trazado al almacén correcto
- `bot_movimientos_almacen.nalmacen_destino_id`: registra entrada al almacén correcto

Además:

- el upsert de lotes ya no mezcla lotes de otro almacén con el mismo código
- la búsqueda de lote existente en compra usa `producto + código de lote + almacén`

## 6. Fallback técnico final

Fallback principal del flujo:

- ninguno

Decisión tomada:

- se eliminó el comportamiento de tomar automáticamente el primer almacén disponible cuando el usuario no elegía uno
- el usuario debe decidir siempre el almacén destino de la compra

Fallback residual aceptado:

- ninguno a nivel de selección de proveedor o almacén

Esto es intencional para no ocultar una decisión operativa crítica.
