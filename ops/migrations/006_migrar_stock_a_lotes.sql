-- =============================================================
-- Migración 006: Convertir stock existente en lotes FEFO
-- Fecha: Abril 2026
-- Idempotente: segura de ejecutar múltiples veces
--
-- PROBLEMA:
--   bot_productos.nstock tiene stock real, pero bot_lotes está
--   vacío o incompleto. FEFO requiere stock por lote para operar.
--
-- ESTRATEGIA:
--   Para cada producto con nstock > 0 y SIN lotes activos:
--   crear un lote "MIGRACION-{id}" usando el vencimiento del
--   producto si existe, o +2 años como fallback conservador.
--
-- PREREQUISITOS:
--   - 004_bot_lotes.sql aplicada (tabla + constraints + índices)
--   - 005_fefo.sql aplicada (columnas nlote_id en kardex/ventas_det)
--
-- EJECUCIÓN:
--   psql -U <usuario> -d botica_db -f 006_migrar_stock_a_lotes.sql
--
-- ROLLBACK:
--   DELETE FROM bot_lotes WHERE cnotas = 'Lote generado por migración 006 — stock a lotes FEFO';
-- =============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. Snapshot previo (verificación antes de migrar)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_productos_con_stock   INT;
    v_productos_sin_lote    INT;
    v_lotes_existentes      INT;
BEGIN
    SELECT COUNT(*) INTO v_productos_con_stock
    FROM bot_productos WHERE nstock > 0;

    SELECT COUNT(*) INTO v_productos_sin_lote
    FROM bot_productos p
    WHERE p.nstock > 0
      AND NOT EXISTS (
          SELECT 1 FROM bot_lotes l
          WHERE l.nproducto_id = p.nid
            AND l.cestado = 'ACTIVO'
            AND l.ncantidad > 0
      );

    SELECT COUNT(*) INTO v_lotes_existentes
    FROM bot_lotes WHERE cestado = 'ACTIVO' AND ncantidad > 0;

    RAISE NOTICE '────────────────────────────────────────';
    RAISE NOTICE 'PRE-MIGRACIÓN:';
    RAISE NOTICE '  Productos con stock > 0 : %', v_productos_con_stock;
    RAISE NOTICE '  Productos SIN lote activo: %', v_productos_sin_lote;
    RAISE NOTICE '  Lotes activos existentes : %', v_lotes_existentes;
    RAISE NOTICE '────────────────────────────────────────';
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Insertar lotes de migración (solo donde faltan)
-- ─────────────────────────────────────────────────────────────
INSERT INTO bot_lotes (
    nproducto_id,
    ccodigo_lote,
    dfechavencimiento,
    ncantidad,
    ncantidad_inicial,
    cestado,
    cnotas
)
SELECT
    p.nid,
    'MIGRACION-' || p.nid,
    COALESCE(
        -- Usar vencimiento del producto si existe y es futuro
        CASE
            WHEN p.tvencimien IS NOT NULL AND p.tvencimien >= CURRENT_DATE
            THEN p.tvencimien::DATE
            ELSE NULL
        END,
        -- Fallback: 2 años desde hoy
        (CURRENT_DATE + INTERVAL '2 years')::DATE
    ),
    p.nstock,
    p.nstock,
    'ACTIVO',
    'Lote generado por migración 006 — stock a lotes FEFO'
FROM bot_productos p
WHERE p.nstock > 0
  AND NOT EXISTS (
      SELECT 1 FROM bot_lotes l
      WHERE l.nproducto_id = p.nid
        AND l.cestado = 'ACTIVO'
        AND l.ncantidad > 0
  );

-- ─────────────────────────────────────────────────────────────
-- 3. Verificación post-migración
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_lotes_creados     INT;
    v_inconsistentes    INT;
BEGIN
    -- Contar lotes recién creados
    SELECT COUNT(*) INTO v_lotes_creados
    FROM bot_lotes
    WHERE cnotas = 'Lote generado por migración 006 — stock a lotes FEFO';

    -- Verificar consistencia: ¿quedan productos con stock pero sin lote?
    SELECT COUNT(*) INTO v_inconsistentes
    FROM bot_productos p
    WHERE p.nstock > 0
      AND NOT EXISTS (
          SELECT 1 FROM bot_lotes l
          WHERE l.nproducto_id = p.nid
            AND l.cestado = 'ACTIVO'
            AND l.ncantidad > 0
      );

    RAISE NOTICE '────────────────────────────────────────';
    RAISE NOTICE 'POST-MIGRACIÓN:';
    RAISE NOTICE '  Lotes creados por migración: %', v_lotes_creados;
    RAISE NOTICE '  Productos inconsistentes   : %', v_inconsistentes;

    IF v_inconsistentes > 0 THEN
        RAISE WARNING '⚠️  Hay % producto(s) con stock > 0 sin lote activo', v_inconsistentes;
    ELSE
        RAISE NOTICE '  ✅ Todos los productos con stock tienen al menos un lote activo';
    END IF;

    RAISE NOTICE '────────────────────────────────────────';
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Reporte de consistencia stock vs lotes
-- ─────────────────────────────────────────────────────────────
SELECT
    p.nid                         AS producto_id,
    p.cnombre                     AS producto,
    p.nstock                      AS stock_producto,
    COALESCE(SUM(l.ncantidad), 0) AS stock_en_lotes,
    p.nstock - COALESCE(SUM(l.ncantidad), 0) AS diferencia
FROM bot_productos p
LEFT JOIN bot_lotes l
    ON l.nproducto_id = p.nid
    AND l.cestado = 'ACTIVO'
WHERE p.nstock > 0
GROUP BY p.nid, p.cnombre, p.nstock
HAVING p.nstock <> COALESCE(SUM(l.ncantidad), 0)
ORDER BY ABS(p.nstock - COALESCE(SUM(l.ncantidad), 0)) DESC;

COMMIT;

-- ─────────────────────────────────────────────────────────────
-- 5. Resumen final (fuera de transacción)
-- ─────────────────────────────────────────────────────────────
SELECT
    '006_migrar_stock_a_lotes OK' AS status,
    COUNT(*)                      AS total_lotes_activos,
    COUNT(CASE WHEN cnotas LIKE '%migración 006%' THEN 1 END) AS lotes_de_migracion
FROM bot_lotes
WHERE cestado = 'ACTIVO';

-- ─────────────────────────────────────────────────────────────
-- 6. Confirmación: productos con diferencia stock vs lotes
--    (debe devolver 0 filas si la migración fue exitosa)
-- ─────────────────────────────────────────────────────────────
SELECT
  p.nid,
  p.cnombre,
  p.nstock,
  COALESCE(SUM(l.ncantidad),0) AS stock_lotes,
  p.nstock - COALESCE(SUM(l.ncantidad),0) AS diferencia
FROM bot_productos p
LEFT JOIN bot_lotes l
  ON l.nproducto_id = p.nid
GROUP BY p.nid, p.cnombre, p.nstock
HAVING p.nstock != COALESCE(SUM(l.ncantidad),0);
