# Fase 05 - Compras y Proveedores

## Objetivo

Aplicar la linea visual del lab a compras y proveedores sin cambiar reglas de negocio ni contratos API.

## Archivos tocados

- `frontend/src/pages/compras-page.tsx`
- `frontend/src/pages/proveedores-page.tsx`

## Cambios en compras

- Resumen superior tipo operativo con total de compras.
- Boton principal con icono.
- Formulario de compra con mas separacion, bloques claros y fondo blanco.
- Selector de proveedor, almacen y pago con estilos consistentes.
- Lineas de producto dentro de contenedores individuales.
- Tabla principal con cabecera gris, padding uniforme y hover verde suave.

## Cambios en proveedores

- Panel superior con total, buscador e indicadores de activo/inactivo/incompleto.
- Buscador con icono.
- Modal menos cargado, avisos redondeados y campos mas consistentes.
- Tabla con cabecera gris, celdas alineadas, hover suave y acciones compactas.

## No cambiado

- Endpoints API.
- Validaciones existentes.
- Persistencia.
- Flujo de alta/edicion.
- Reglas de compra contado/credito.

## Pendiente

- QA visual con navegador en desktop/mobile.
- Segunda pasada a caja, ventas y dashboard.
- Revisión posterior de vulnerabilidades `npm audit`.
