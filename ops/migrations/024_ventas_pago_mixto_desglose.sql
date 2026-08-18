-- P2: desglose auditable de pago mixto en ventas.

ALTER TABLE bot_ventas
  ADD COLUMN IF NOT EXISTS nmonto_efectivo NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nmonto_digital NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nvuelto NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cmetodo_pago_secundario VARCHAR(20);

UPDATE bot_ventas
SET nmonto_efectivo = CASE
      WHEN cmetpago = 'Efectivo'
       AND COALESCE(nmonto_efectivo, 0) = 0
       AND COALESCE(nmonto_digital, 0) = 0
        THEN COALESCE(ntotal, 0)
      ELSE nmonto_efectivo
    END,
    nmonto_digital = CASE
      WHEN cmetpago = 'Yape'
       AND COALESCE(nmonto_efectivo, 0) = 0
       AND COALESCE(nmonto_digital, 0) = 0
        THEN COALESCE(ntotal, 0)
      ELSE nmonto_digital
    END
WHERE cmetpago IN ('Efectivo', 'Yape');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_bot_ventas_pago_desglose_non_negative'
      AND conrelid = 'bot_ventas'::regclass
  ) THEN
    ALTER TABLE bot_ventas
      ADD CONSTRAINT chk_bot_ventas_pago_desglose_non_negative
      CHECK (nmonto_efectivo >= 0 AND nmonto_digital >= 0 AND nvuelto >= 0);
  END IF;
END $$;

COMMENT ON COLUMN bot_ventas.nmonto_efectivo IS 'Monto efectivo recibido en la venta.';
COMMENT ON COLUMN bot_ventas.nmonto_digital IS 'Monto digital/tarjeta recibido en la venta.';
COMMENT ON COLUMN bot_ventas.nvuelto IS 'Vuelto entregado al cliente.';
COMMENT ON COLUMN bot_ventas.cmetodo_pago_secundario IS 'Método secundario usado en pago mixto.';
