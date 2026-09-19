-- Detalle de compra conserva lote esperado; recepción aplica stock real.
-- Idempotente.

ALTER TABLE bot_compras_det
  ADD COLUMN IF NOT EXISTS ccodigo_lote VARCHAR(100),
  ADD COLUMN IF NOT EXISTS dfecha_vencimiento DATE,
  ADD COLUMN IF NOT EXISTS cnotas_lote TEXT;

ALTER TABLE bot_recepcion_det
  ADD COLUMN IF NOT EXISTS ncompra_det_id INTEGER REFERENCES bot_compras_det(nid);

CREATE INDEX IF NOT EXISTS idx_bot_recepcion_det_compra_det ON bot_recepcion_det(ncompra_det_id);
