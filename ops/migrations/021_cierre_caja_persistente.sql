-- Fase 4: cierre de caja persistente.
-- napertura, ncierre y tcierre ya existen; se agregan totales calculados al momento del cierre.

ALTER TABLE bot_caja
  ADD COLUMN IF NOT EXISTS nventas_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ningresos_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS negresos_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS npagos_factura_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ngastos_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nsaldo_esperado NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ndiferencia NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ncerrado_por_id INTEGER NULL,
  ADD COLUMN IF NOT EXISTS ccerrado_por VARCHAR(120) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bot_caja_ncerrado_por_id_fkey'
      AND conrelid = 'bot_caja'::regclass
  ) THEN
    ALTER TABLE bot_caja
      ADD CONSTRAINT bot_caja_ncerrado_por_id_fkey
      FOREIGN KEY (ncerrado_por_id) REFERENCES bot_usuarios(nid);
  END IF;
END $$;
