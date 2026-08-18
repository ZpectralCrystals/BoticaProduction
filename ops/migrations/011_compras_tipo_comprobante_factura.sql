-- ═════════════════════════════════════════════════════════════
-- 011_compras_tipo_comprobante_factura.sql
-- Aclara la persistencia de compras:
--   - ctipo_comprobante = tipo controlado
--   - cdocumento        = número de comprobante
-- En esta fase solo se permite FACTURA.
-- ═════════════════════════════════════════════════════════════

ALTER TABLE bot_compras
  ADD COLUMN IF NOT EXISTS ctipo_comprobante VARCHAR(20);

UPDATE bot_compras
SET ctipo_comprobante = 'FACTURA'
WHERE ctipo_comprobante IS NULL OR BTRIM(ctipo_comprobante) = '';

ALTER TABLE bot_compras
  ALTER COLUMN ctipo_comprobante SET DEFAULT 'FACTURA';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_bot_compras_tipo_comprobante'
  ) THEN
    ALTER TABLE bot_compras
      ADD CONSTRAINT chk_bot_compras_tipo_comprobante
      CHECK (ctipo_comprobante IN ('FACTURA'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_compras_tipo_comprobante
  ON bot_compras (ctipo_comprobante);
