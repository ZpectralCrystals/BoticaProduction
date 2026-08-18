-- =============================================================
-- Migración 004: Tabla bot_lotes — Soporte de lotes para FEFO
-- Fecha: Abril 2026
-- Idempotente: segura de ejecutar múltiples veces
--
-- OBJETIVO:
--   Preparar soporte de lotes para trazabilidad FEFO
--   (First Expired, First Out) en ventas futuras.
--   Compatible con instalaciones previas que ya tengan bot_lotes.
--
-- EJECUCIÓN:
--   psql -U <usuario> -d botica_db -f 004_bot_lotes.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Crear tabla si NO existe (instalación fresca)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_lotes (
    nid               SERIAL       PRIMARY KEY,
    nproducto_id      INTEGER      NOT NULL,
    ncompra_id        INTEGER,
    ccodigo_lote      VARCHAR(100),
    dfechavencimiento DATE         NOT NULL,
    ncantidad         INTEGER      NOT NULL DEFAULT 0,
    ncantidad_inicial INTEGER      NOT NULL DEFAULT 0,
    cestado           VARCHAR(10)  NOT NULL DEFAULT 'ACTIVO',
    cnotas            TEXT,
    nversion          INTEGER      NOT NULL DEFAULT 1,
    tcreado           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    tmodifi           TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- 2. Agregar columnas faltantes en instalaciones previas
--    Algunas instalaciones antiguas pueden tener columnas con
--    nombres distintos.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bot_lotes ADD COLUMN IF NOT EXISTS ncompra_id        INTEGER;
ALTER TABLE bot_lotes ADD COLUMN IF NOT EXISTS ccodigo_lote      VARCHAR(100);
ALTER TABLE bot_lotes ADD COLUMN IF NOT EXISTS ncantidad_inicial INTEGER DEFAULT 0;
ALTER TABLE bot_lotes ADD COLUMN IF NOT EXISTS cnotas            TEXT;
ALTER TABLE bot_lotes ADD COLUMN IF NOT EXISTS nversion          INTEGER DEFAULT 1;
ALTER TABLE bot_lotes ADD COLUMN IF NOT EXISTS tmodifi           TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Sincronizar ncantidad_inicial desde filas existentes
UPDATE bot_lotes
SET ncantidad_inicial = ncantidad
WHERE ncantidad_inicial = 0 AND ncantidad > 0;

-- ─────────────────────────────────────────────────────────────
-- 3. Constraints — solo si no existen
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_lotes_cantidad'
    ) THEN
        ALTER TABLE bot_lotes
            ADD CONSTRAINT chk_bot_lotes_cantidad CHECK (ncantidad >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_lotes_estado'
    ) THEN
        ALTER TABLE bot_lotes
            ADD CONSTRAINT chk_bot_lotes_estado
            CHECK (cestado IN ('ACTIVO', 'AGOTADO', 'VENCIDO'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_bot_lotes_producto'
    ) THEN
        ALTER TABLE bot_lotes
            ADD CONSTRAINT fk_bot_lotes_producto
            FOREIGN KEY (nproducto_id) REFERENCES bot_productos(nid) ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_bot_lotes_compra'
    ) THEN
        ALTER TABLE bot_lotes
            ADD CONSTRAINT fk_bot_lotes_compra
            FOREIGN KEY (ncompra_id) REFERENCES bot_compras(nid) ON DELETE SET NULL;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Índices de performance
-- ─────────────────────────────────────────────────────────────

-- Consulta general por producto + estado
CREATE INDEX IF NOT EXISTS idx_bot_lotes_producto_estado
    ON bot_lotes(nproducto_id, cestado);

-- Índice FEFO: lotes activos con stock, ordenados por vencimiento
CREATE INDEX IF NOT EXISTS idx_bot_lotes_fefo
    ON bot_lotes(nproducto_id, dfechavencimiento ASC)
    WHERE ncantidad > 0 AND cestado = 'ACTIVO';

-- Alertas de vencimiento próximo
CREATE INDEX IF NOT EXISTS idx_bot_lotes_vencimiento
    ON bot_lotes(dfechavencimiento)
    WHERE cestado = 'ACTIVO';

-- Trazabilidad por compra origen
CREATE INDEX IF NOT EXISTS idx_bot_lotes_compra
    ON bot_lotes(ncompra_id);

-- ─────────────────────────────────────────────────────────────
-- 5. Trigger para auto-actualizar tmodifi
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_bot_lotes_set_tmodifi()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.tmodifi = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_lotes_tmodifi ON bot_lotes;
CREATE TRIGGER trg_bot_lotes_tmodifi
    BEFORE UPDATE ON bot_lotes
    FOR EACH ROW
    EXECUTE FUNCTION fn_bot_lotes_set_tmodifi();

-- ─────────────────────────────────────────────────────────────
-- 6. Vista FEFO: próximo lote a usar por producto
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_bot_lotes_fefo AS
SELECT DISTINCT ON (l.nproducto_id)
    l.nproducto_id,
    p.cnombre                        AS producto_nombre,
    p.ccodigo                        AS producto_codigo,
    p.nstock                         AS stock_total,
    l.nid                            AS lote_fefo_id,
    l.ccodigo_lote,
    l.dfechavencimiento,
    l.ncantidad                      AS cantidad_lote,
    (l.dfechavencimiento - CURRENT_DATE) AS dias_para_vencer,
    CASE
        WHEN l.dfechavencimiento < CURRENT_DATE THEN 'VENCIDO'
        WHEN (l.dfechavencimiento - CURRENT_DATE) <= 30 THEN 'CRITICO'
        WHEN (l.dfechavencimiento - CURRENT_DATE) <= 90 THEN 'PROXIMO'
        ELSE 'OK'
    END                              AS alerta_vencimiento
FROM bot_lotes l
JOIN bot_productos p ON p.nid = l.nproducto_id
WHERE l.cestado = 'ACTIVO'
  AND l.ncantidad > 0
  AND l.dfechavencimiento >= CURRENT_DATE
ORDER BY l.nproducto_id, l.dfechavencimiento ASC, l.tcreado ASC;

-- ─────────────────────────────────────────────────────────────
-- 7. Verificación
-- ─────────────────────────────────────────────────────────────
SELECT
    'bot_lotes OK' AS status,
    COUNT(*)       AS filas_existentes,
    COUNT(CASE WHEN cestado = 'ACTIVO' THEN 1 END) AS lotes_activos
FROM bot_lotes;
