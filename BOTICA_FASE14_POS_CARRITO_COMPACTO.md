# BOTICA FASE 14B/14C - POS carrito compacto y pago mixto automático

## 1. Resumen

Se ajustó el POS para mejorar uso de espacio, evitar superposición entre selector de precio y subtotal, mover el método de pago al panel lateral de cliente y automatizar el pago mixto.
En Fase 14C se cerraron ajustes de React Doctor en los componentes POS tocados, sin modificar backend.

## 2. Problemas corregidos

- El selector de precio y el subtotal podían quedar desalineados o montados en filas compactas del carrito.
- El método de pago estaba debajo del carrito, ocupando espacio vertical de operación.
- En pago mixto, el monto digital no se completaba automáticamente con el saldo pendiente.

## 3. Archivos revisados

- `frontend/src/pos/components/Cart.tsx`
- `frontend/src/pos/components/Cart.test.tsx`
- `frontend/src/pos/components/PaymentPanel.tsx`
- `frontend/src/pos/components/SalesPOS.tsx`
- `frontend/src/pos/hooks/usePOS.ts`
- `frontend/src/pos/hooks/usePOS.test.ts`
- `frontend/src/pos/types/index.ts`
- `frontend/src/pos/utils/posUtils.ts`
- `frontend/src/pos/utils/posUtils.test.ts`

## 4. Archivos modificados

- `frontend/src/pos/components/Cart.tsx`
- `frontend/src/pos/components/PaymentPanel.tsx`
- `frontend/src/pos/components/PaymentPanel.test.tsx`
- `frontend/src/pos/components/SalesPOS.tsx`
- `BOTICA_FASE14_POS_CARRITO_COMPACTO.md`

## 5. Cambios aplicados

- Se ajustó la grilla compacta del carrito con columnas fijas para cantidad, precio, subtotal y acción.
- Se aplicó `min-w-0`, ancho completo y truncado controlado para evitar solapes visuales.
- Se movió el panel de pago debajo del panel Cliente en la columna derecha del POS.
- Se eliminó el panel de pago duplicado debajo del carrito.
- Se agregó cálculo automático para pago mixto:
  - Si total es `200` y efectivo es `50`, digital pendiente queda en `150`.
  - Si efectivo supera el total, digital queda en `0` y el vuelto se calcula normalmente.
- El campo digital en pago mixto queda de solo lectura porque representa el pendiente automático.
- Se removió sincronización derivada por `useEffect` en `Cart.tsx` para evitar warning de estado derivado.
- Se extrajeron constantes de pago/calculadora fuera de `PaymentPanel.tsx`.
- Se estabilizaron handlers de `PaymentPanel.tsx` con `useCallback`.
- Se estabilizaron handlers principales de `SalesPOS.tsx` con `useCallback` para reducir props inline hacia hijos.

## 6. Alcance respetado

No se tocaron backend, caja, FEFO, compras, cuentas por pagar ni reportes backend.

## 7. Validaciones ejecutadas

```bash
cd frontend && npm test -- PaymentPanel.test.tsx Cart.test.tsx
cd frontend && npm test -- usePOS.test.ts posUtils.test.ts
cd frontend && npx tsc --noEmit
cd frontend && npm run lint
cd frontend && npm test
cd frontend && npm run build
```

Resultado:

- Tests focales POS: OK, 16 tests.
- Tests hook/utils POS: OK, 37 tests.
- TypeScript: OK.
- Lint frontend: OK.
- Suite frontend completa: OK, 55 tests.
- Build frontend: OK.

Notas:

- `usePOS.test.ts` mantiene warning preexistente de React `act(...)`.
- Vite mantiene warning preexistente por chunk mayor a 500 KB.

## 8. React Doctor

React Doctor había marcado advertencias en:

- `frontend/src/pos/components/Cart.tsx`
- `frontend/src/pos/components/PaymentPanel.tsx`
- `frontend/src/pos/components/SalesPOS.tsx`

Acciones:

- `Cart.tsx`: se evitó `setState` derivado dentro de efecto para borradores de cantidad.
- `PaymentPanel.tsx`: se redujo creación de arrays/handlers por render.
- `SalesPOS.tsx`: se reemplazaron callbacks inline relevantes por handlers estables.
