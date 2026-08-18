# Fase 02 - Layout global

## Objetivo
- Llevar estructura global hacia estilo FCA: sidebar fijo, limpio, agrupado, menos decorativo.

## Hecho
- Sidebar desktop:
  - Abierto `w-64`.
  - Cerrado `w-20`.
  - Fondo blanco.
  - Borde derecho.
  - Sin glass ni radios gigantes.
- Navegacion agrupada:
  - Operacion.
  - Comercial.
  - Clinica.
  - Inventario avanzado.
  - Administracion.
- Items:
  - Altura fija `h-11`.
  - Radius `rounded-lg`.
  - Activo verde con texto/icono blanco.
  - Cerrado muestra solo iconos + tooltip.
- Header:
  - Fondo blanco.
  - Border bottom.
  - Titulo directo, sin uppercase exagerado.
  - Fecha en chip sobrio.
- Main:
  - Scroll independiente.
  - Padding uniforme `p-4/sm:p-6`.
- Mobile:
  - Drawer mantiene funcionamiento.

## Archivos
- `frontend/src/components/layout/app-shell.tsx`

## Riesgo
- Orden de menu cambio visualmente por grupos, rutas iguales.
- Algunas paginas con cards grandes pueden sentirse aun viejas hasta Fase 03/04.

## Estado
- Fase completa.
