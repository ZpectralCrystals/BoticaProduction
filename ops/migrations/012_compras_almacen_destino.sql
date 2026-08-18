-- ═════════════════════════════════════════════════════════════
-- 012_compras_almacen_destino.sql
-- Hace explícito el almacén destino en la cabecera de compras.
-- ═════════════════════════════════════════════════════════════

ALTER TABLE bot_compras
  ADD COLUMN IF NOT EXISTS nalmacen_id INT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_bot_compras_almacen'
  ) THEN
    ALTER TABLE bot_compras
      ADD CONSTRAINT fk_bot_compras_almacen
      FOREIGN KEY (nalmacen_id) REFERENCES bot_almacenes(nid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_compras_almacen
  ON bot_compras (nalmacen_id);

-- Backfill best-effort desde lotes ya registrados por compra.
UPDATE bot_compras c
SET nalmacen_id = sub.nalmacen_id
FROM (
  SELECT DISTINCT ON (ncompra_id)
    ncompra_id,
    nalmacen_id
  FROM bot_lotes
  WHERE ncompra_id IS NOT NULL
    AND nalmacen_id IS NOT NULL
  ORDER BY ncompra_id, nid
) sub
WHERE c.nid = sub.ncompra_id
  AND c.nalmacen_id IS NULL;
