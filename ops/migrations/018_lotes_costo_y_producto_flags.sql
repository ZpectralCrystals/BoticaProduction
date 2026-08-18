-- =============================================================
-- Migración 018: Lotes con costo + flags de producto
-- Fecha: Mayo 2026
-- Idempotente.
--
-- OBJETIVOS:
--   1) bot_lotes.nprecio_compra (costo de compra por lote — FIFO real)
--   2) bot_productos.lrequiere_lote (flag obligatorio para medicamentos)
--   3) bot_productos.lrequiere_vencimiento (flag obligatorio expiry)
--   4) bot_compras.ctipo_pago (CONTADO|CREDITO)
--   5) bot_compras.tfecha_vencimiento (fecha de pago para crédito)
--   6) bot_compras.nusuario_id (FK a bot_usuarios — si no existe)
--   7) Index FEFO actualizado para filtrar lotes vencidos
--
-- EJECUCIÓN:
--   psql -U botica -d botica_db -f 018_lotes_costo_y_producto_flags.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) bot_lotes.nprecio_compra (costo unitario por lote)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bot_lotes
  ADD COLUMN IF NOT EXISTS nprecio_compra NUMERIC(10, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_lotes_precio_compra_non_negative'
  ) THEN
    ALTER TABLE bot_lotes
      ADD CONSTRAINT chk_bot_lotes_precio_compra_non_negative
      CHECK (nprecio_compra >= 0);
  END IF;
END $$;

COMMENT ON COLUMN bot_lotes.nprecio_compra IS
  'Costo unitario de compra para el lote. Se hereda del bot_compras_det.npreunit al ingresar la compra.';

-- Backfill desde compras_det si lote linkeado por ncompra_id
UPDATE bot_lotes l
SET nprecio_compra = sub.npreunit
FROM (
  SELECT d.ncompra_id, d.nproducto_id, AVG(d.npreunit) AS npreunit
  FROM bot_compras_det d
  GROUP BY d.ncompra_id, d.nproducto_id
) sub
WHERE l.ncompra_id = sub.ncompra_id
  AND l.nproducto_id = sub.nproducto_id
  AND (l.nprecio_compra IS NULL OR l.nprecio_compra = 0);

-- ─────────────────────────────────────────────────────────────
-- 2) bot_productos: flags requiere_lote + requiere_vencimiento
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bot_productos
  ADD COLUMN IF NOT EXISTS lrequiere_lote BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE bot_productos
  ADD COLUMN IF NOT EXISTS lrequiere_vencimiento BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN bot_productos.lrequiere_lote IS
  'Si TRUE, las compras deben capturar código de lote para este producto.';

COMMENT ON COLUMN bot_productos.lrequiere_vencimiento IS
  'Si TRUE, las compras deben capturar fecha de vencimiento para este producto.';

-- Defaults: medicamentos (creceta IN ('S','R')) requieren ambos
UPDATE bot_productos
SET lrequiere_lote = TRUE,
    lrequiere_vencimiento = TRUE
WHERE lrequiere_lote IS NULL OR lrequiere_vencimiento IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3) bot_compras.ctipo_pago + tfecha_vencimiento + nusuario_id
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bot_compras
  ADD COLUMN IF NOT EXISTS ctipo_pago VARCHAR(10) NOT NULL DEFAULT 'CONTADO';

ALTER TABLE bot_compras
  ADD COLUMN IF NOT EXISTS tfecha_vencimiento DATE;

ALTER TABLE bot_compras
  ADD COLUMN IF NOT EXISTS nusuario_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_compras_tipo_pago'
  ) THEN
    ALTER TABLE bot_compras
      ADD CONSTRAINT chk_bot_compras_tipo_pago
      CHECK (ctipo_pago IN ('CONTADO', 'CREDITO'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_bot_compras_usuario'
  ) THEN
    BEGIN
      ALTER TABLE bot_compras
        ADD CONSTRAINT fk_bot_compras_usuario
        FOREIGN KEY (nusuario_id) REFERENCES bot_usuarios(nid) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'fk_bot_compras_usuario no creado (puede que bot_usuarios no exista aun)';
    END;
  END IF;
END $$;

COMMENT ON COLUMN bot_compras.ctipo_pago IS
  'CONTADO: descarga inmediata de caja. CREDITO: genera cuenta por pagar.';

COMMENT ON COLUMN bot_compras.tfecha_vencimiento IS
  'Fecha de vencimiento de factura cuando ctipo_pago = CREDITO.';

-- ─────────────────────────────────────────────────────────────
-- 4) Reindex FEFO con consideración de costo (no estricto pero útil)
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_bot_lotes_fefo;
CREATE INDEX IF NOT EXISTS idx_bot_lotes_fefo
  ON bot_lotes(nproducto_id, dfechavencimiento ASC, tcreado ASC)
  WHERE ncantidad > 0 AND cestado = 'ACTIVO';

-- ─────────────────────────────────────────────────────────────
-- 5) Verificación
-- ─────────────────────────────────────────────────────────────
SELECT
  'bot_lotes.nprecio_compra'   AS columna,
  COUNT(*)                     AS filas,
  COUNT(CASE WHEN nprecio_compra > 0 THEN 1 END) AS con_costo
FROM bot_lotes;

SELECT
  'bot_productos.flags' AS columna,
  COUNT(*)              AS productos,
  COUNT(CASE WHEN lrequiere_lote THEN 1 END)         AS req_lote,
  COUNT(CASE WHEN lrequiere_vencimiento THEN 1 END)  AS req_vencimiento
FROM bot_productos;

SELECT
  'bot_compras.tipo_pago' AS columna,
  ctipo_pago,
  COUNT(*) AS filas
FROM bot_compras
GROUP BY ctipo_pago;
