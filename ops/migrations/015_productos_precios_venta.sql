-- ═════════════════════════════════════════════════════════════
-- 015_productos_precios_venta.sql
-- Precios comerciales multiples por producto.
--
-- Compatibilidad:
-- - bot_productos.npreventa se reutiliza como precio_venta_1.
-- - npreventa_2 y npreventa_3 son opcionales.
-- - nprecompra sigue siendo costo de ultima compra/lote y no se edita desde productos.
-- ═════════════════════════════════════════════════════════════

ALTER TABLE bot_productos
  ADD COLUMN IF NOT EXISTS npreventa_2 NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS npreventa_3 NUMERIC(10, 2);

UPDATE bot_productos
SET npreventa_2 = NULL
WHERE npreventa_2 IS NOT NULL
  AND npreventa_2 = 0;

UPDATE bot_productos
SET npreventa_3 = NULL
WHERE npreventa_3 IS NOT NULL
  AND npreventa_3 = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_bot_productos_npreventa_non_negative'
  ) THEN
    ALTER TABLE bot_productos
      ADD CONSTRAINT chk_bot_productos_npreventa_non_negative
      CHECK (npreventa >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_bot_productos_npreventa_2_non_negative'
  ) THEN
    ALTER TABLE bot_productos
      ADD CONSTRAINT chk_bot_productos_npreventa_2_non_negative
      CHECK (npreventa_2 IS NULL OR npreventa_2 >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_bot_productos_npreventa_3_non_negative'
  ) THEN
    ALTER TABLE bot_productos
      ADD CONSTRAINT chk_bot_productos_npreventa_3_non_negative
      CHECK (npreventa_3 IS NULL OR npreventa_3 >= 0);
  END IF;
END $$;

COMMENT ON COLUMN bot_productos.npreventa IS
  'Precio de venta principal (precio_venta_1). Campo historico reutilizado por compatibilidad.';

COMMENT ON COLUMN bot_productos.npreventa_2 IS
  'Precio de venta opcional 2.';

COMMENT ON COLUMN bot_productos.npreventa_3 IS
  'Precio de venta opcional 3.';
