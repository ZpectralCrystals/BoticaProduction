# Fase 03 - Componentes base

## Objetivo
- Normalizar piezas UI reutilizables para que paginas empiecen a verse coherentes.

## Hecho
- `Button`:
  - Radius `rounded-lg`.
  - Menos sombra.
  - Alto default `h-10`.
  - Focus ring uniforme.
- `Card`:
  - Fondo blanco.
  - Radius `rounded-xl`.
  - Shadow minima.
  - Padding mas compacto.
- `Input`, `Select`, `Textarea`:
  - Radius `rounded-lg`.
  - Fondo blanco.
  - Focus verde suave.
  - Disabled claro.
- `Table`:
  - Contenedor blanco.
  - Header gris suave.
  - Hover verde muy leve.
  - Header uppercase.
- `Dialog`:
  - Modal blanco, radius menor.
  - Overlay sobrio.

## Archivos
- `frontend/src/components/ui/button-variants.ts`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/textarea.tsx`
- `frontend/src/components/ui/table.tsx`
- `frontend/src/components/ui/dialog.tsx`

## Riesgo
- Paginas viejas con clases hardcodeadas aun pueden verse mezcladas.
- Se corrige por modulo desde Fase 04.

## Estado
- Fase completa.
