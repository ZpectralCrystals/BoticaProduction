# FIX: Estado de anulación de ventas
**Fecha:** 12 Abril 2026

---

## Causa del error

```
new row for relation "bot_ventas" violates check constraint "bot_ventas_cestado_check"
```

El backend escribía `cestado = 'I'` al anular una venta, pero el CHECK constraint de la BD solo permite:

```sql
CHECK (cestado = ANY (ARRAY['A'::bpchar, 'F'::bpchar, 'C'::bpchar]))
```

`'I'` nunca fue un valor válido.

---

## Convención final

| Valor | Significado |
|---|---|
| `A` | Activa |
| `F` | Facturada (reservado) |
| `C` | Cancelada / Anulada |

**No se requiere migración de BD** — el constraint ya acepta `C`.

---

## Cambios realizados

### Backend — `sales.routes.ts`

| Línea | Antes | Después |
|---|---|---|
| Check doble anulación | `venta.cestado === 'I'` | `venta.cestado === 'C'` |
| UPDATE al anular | `SET cestado = 'I'` | `SET cestado = 'C'` |

### Frontend — `sales-page.tsx`

| Línea | Antes | Después |
|---|---|---|
| Estilo fila anulada | `v.estado === 'I'` | `v.estado === 'C'` |
| Badge de estado | Ya usaba `v.estado === 'A'` para "Activa", else "Anulada" ✅ | Sin cambio |

### Tests — `sales.test.ts`

| Test | Cambio |
|---|---|
| Anular sin FEFO | Mock y comentarios: `'I'` → `'C'` |
| Anular con FEFO | Mock y comentarios: `'I'` → `'C'` |
| 409 doble anulación | Mock: `cestado: 'I'` → `cestado: 'C'` |

---

## Validación

- **82/82 tests pasan** (35 backend + 47 frontend)
- **TypeScript** — 0 errores en ambos
- Constraint `bot_ventas_cestado_check` acepta `C` ✅
- Doble anulación retorna `409` ✅
- Frontend muestra "Anulada" con badge rojo y row atenuada ✅

---

## Archivos modificados

- `backend-fastify/src/routes/sales.routes.ts`
- `backend-fastify/src/__tests__/sales.test.ts`
- `frontend/src/pages/sales-page.tsx`
