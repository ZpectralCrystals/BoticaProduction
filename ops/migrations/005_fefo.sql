-- =============================================================
-- Migración 005: FEFO — Columnas de trazabilidad de lotes
-- Fecha: Abril 2026
-- Idempotente: segura de ejecutar múltiples veces
--
-- OBJETIVO:
--   Vincular los registros de Kardex y detalle de venta con
--   el lote específico que fue afectado en la operación.
--   Habilita trazabilidad FEFO completa en auditorías.
--
-- REQUISITO PREVIO:
--   - 003_bot_kardex.sql  (tabla bot_kardex)
--   - 004_bot_lotes.sql   (tabla bot_lotes)
--
-- EJECUCIÓN:
--   psql -U <usuario> -d botica_db -f 005_fefo.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Ampliar bot_kardex con referencia al lote
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bot_kardex ADD COLUMN IF NOT EXISTS nlote_id     INTEGER;
ALTER TABLE bot_kardex ADD COLUMN IF NOT EXISTS ccodigo_lote VARCHAR(100);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_kardex_lote'
    ) THEN
        ALTER TABLE bot_kardex
            ADD CONSTRAINT fk_kardex_lote
            FOREIGN KEY (nlote_id) REFERENCES bot_lotes(nid) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_kardex_lote
    ON bot_kardex(nlote_id)
    WHERE nlote_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 2. Ampliar bot_ventas_det con lote primario consumido
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bot_ventas_det ADD COLUMN IF NOT EXISTS nlote_id     INTEGER;
ALTER TABLE bot_ventas_det ADD COLUMN IF NOT EXISTS clote_codigo VARCHAR(100);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_ventas_det_lote'
    ) THEN
        ALTER TABLE bot_ventas_det
            ADD CONSTRAINT fk_ventas_det_lote
            FOREIGN KEY (nlote_id) REFERENCES bot_lotes(nid) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_ventas_det_lote
    ON bot_ventas_det(nlote_id)
    WHERE nlote_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. Verificación
-- ─────────────────────────────────────────────────────────────
SELECT
    'bot_kardex'    AS tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'bot_kardex'
  AND column_name IN ('nlote_id', 'ccodigo_lote')
UNION ALL
SELECT
    'bot_ventas_det',
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'bot_ventas_det'
  AND column_name IN ('nlote_id', 'clote_codigo');
