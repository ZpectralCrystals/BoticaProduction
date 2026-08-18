-- Fase 6: productos no medicamentosos.
-- MEDICAMENTO conserva reglas estrictas; NO_MEDICAMENTO permite composicion/lote/vencimiento opcionales.

ALTER TABLE bot_productos
  ADD COLUMN IF NOT EXISTS ctipo_producto VARCHAR(30) NOT NULL DEFAULT 'MEDICAMENTO';

UPDATE bot_productos
SET ctipo_producto = 'MEDICAMENTO'
WHERE ctipo_producto IS NULL OR BTRIM(ctipo_producto) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bot_productos_ctipo_producto_check'
      AND conrelid = 'bot_productos'::regclass
  ) THEN
    ALTER TABLE bot_productos
      ADD CONSTRAINT bot_productos_ctipo_producto_check
      CHECK (ctipo_producto IN ('MEDICAMENTO', 'NO_MEDICAMENTO'));
  END IF;
END $$;
