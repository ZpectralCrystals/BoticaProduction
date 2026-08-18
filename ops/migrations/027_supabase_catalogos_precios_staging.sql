-- =============================================================
-- Migracion 027: catalogos producto + precios canonicos (staging)
-- Fecha: Agosto 2026
-- Alcance: solo DB staging local.
--
-- Objetivos:
--   1) Poblar bot_familias_producto desde bot_productos.cfamilia.
--   2) Poblar bot_categorias_producto desde bot_productos.ccategoria.
--   3) Backfill nfamilia_id / ncategoria_id en bot_productos.
--   4) Poblar bot_producto_precios desde npreventa / npreventa_2 / npreventa_3.
--   5) Dejar historial de precios via triggers existentes.
-- =============================================================

BEGIN;

DO $$
BEGIN
  IF current_database() NOT LIKE 'botica_db_staging_%' THEN
    RAISE EXCEPTION 'Migration 027 blocked: current database % is not staging', current_database();
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_familias_producto_nombre_activo
  ON bot_familias_producto (LOWER(BTRIM(cnombre)))
  WHERE cestado = 'A';

CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_categorias_producto_nombre_activo
  ON bot_categorias_producto (LOWER(BTRIM(cnombre)))
  WHERE cestado = 'A';

CREATE INDEX IF NOT EXISTS ix_bot_categorias_producto_familia
  ON bot_categorias_producto (nfamilia_id);

CREATE INDEX IF NOT EXISTS ix_bot_productos_familia_id
  ON bot_productos (nfamilia_id);

CREATE INDEX IF NOT EXISTS ix_bot_productos_categoria_id
  ON bot_productos (ncategoria_id);

CREATE INDEX IF NOT EXISTS idx_bot_producto_precios_producto
  ON bot_producto_precios(nproducto_id);

CREATE INDEX IF NOT EXISTS idx_bot_producto_precios_activo
  ON bot_producto_precios(nproducto_id, lactivo)
  WHERE lactivo = TRUE;

CREATE INDEX IF NOT EXISTS idx_bot_producto_precios_hist_producto
  ON bot_producto_precios_hist(nproducto_id, tcreado DESC);

WITH familias_origen AS (
  SELECT DISTINCT BTRIM(cfamilia) AS cnombre
  FROM bot_productos
  WHERE cfamilia IS NOT NULL
    AND BTRIM(cfamilia) <> ''
)
INSERT INTO bot_familias_producto (cnombre, cdescripcion, cestado)
SELECT
  fo.cnombre,
  'Backfill Fase 4 pre-Supabase desde bot_productos.cfamilia',
  'A'
FROM familias_origen fo
WHERE NOT EXISTS (
  SELECT 1
  FROM bot_familias_producto f
  WHERE f.cestado = 'A'
    AND LOWER(BTRIM(f.cnombre)) = LOWER(BTRIM(fo.cnombre))
);

WITH categorias_origen AS (
  SELECT DISTINCT ON (LOWER(BTRIM(p.ccategoria)))
    BTRIM(p.ccategoria) AS cnombre,
    f.nid AS nfamilia_id
  FROM bot_productos p
  LEFT JOIN bot_familias_producto f
    ON f.cestado = 'A'
   AND LOWER(BTRIM(f.cnombre)) = LOWER(BTRIM(p.cfamilia))
  WHERE p.ccategoria IS NOT NULL
    AND BTRIM(p.ccategoria) <> ''
  ORDER BY LOWER(BTRIM(p.ccategoria)), f.nid NULLS LAST
)
INSERT INTO bot_categorias_producto (nfamilia_id, cnombre, cdescripcion, cestado)
SELECT
  co.nfamilia_id,
  co.cnombre,
  'Backfill Fase 4 pre-Supabase desde bot_productos.ccategoria',
  'A'
FROM categorias_origen co
WHERE NOT EXISTS (
  SELECT 1
  FROM bot_categorias_producto c
  WHERE c.cestado = 'A'
    AND LOWER(BTRIM(c.cnombre)) = LOWER(BTRIM(co.cnombre))
);

UPDATE bot_productos p
SET
  nfamilia_id = f.nid,
  tmodifi = CURRENT_TIMESTAMP
FROM bot_familias_producto f
WHERE p.cfamilia IS NOT NULL
  AND BTRIM(p.cfamilia) <> ''
  AND f.cestado = 'A'
  AND LOWER(BTRIM(f.cnombre)) = LOWER(BTRIM(p.cfamilia))
  AND p.nfamilia_id IS DISTINCT FROM f.nid;

UPDATE bot_productos p
SET
  ncategoria_id = c.nid,
  tmodifi = CURRENT_TIMESTAMP
FROM bot_categorias_producto c
WHERE p.ccategoria IS NOT NULL
  AND BTRIM(p.ccategoria) <> ''
  AND c.cestado = 'A'
  AND LOWER(BTRIM(c.cnombre)) = LOWER(BTRIM(p.ccategoria))
  AND p.ncategoria_id IS DISTINCT FROM c.nid;

WITH precios_origen AS (
  SELECT nid AS nproducto_id, 'PRECIO_1'::VARCHAR(20) AS cnombre, npreventa AS nprecio
  FROM bot_productos
  WHERE npreventa IS NOT NULL AND npreventa > 0
  UNION ALL
  SELECT nid, 'PRECIO_2'::VARCHAR(20), npreventa_2
  FROM bot_productos
  WHERE npreventa_2 IS NOT NULL AND npreventa_2 > 0
  UNION ALL
  SELECT nid, 'PRECIO_3'::VARCHAR(20), npreventa_3
  FROM bot_productos
  WHERE npreventa_3 IS NOT NULL AND npreventa_3 > 0
)
INSERT INTO bot_producto_precios (nproducto_id, cnombre, nprecio, lactivo, cusuario)
SELECT
  po.nproducto_id,
  po.cnombre,
  po.nprecio,
  TRUE,
  'system_fase4_supabase'
FROM precios_origen po
ON CONFLICT (nproducto_id, cnombre) DO UPDATE
SET
  nprecio = EXCLUDED.nprecio,
  lactivo = TRUE,
  cusuario = 'system_fase4_supabase',
  tmodifi = CURRENT_TIMESTAMP
WHERE bot_producto_precios.nprecio IS DISTINCT FROM EXCLUDED.nprecio
   OR bot_producto_precios.lactivo IS DISTINCT FROM TRUE;

INSERT INTO bot_auditoria (
  nusuario_id,
  cusuario,
  caccion,
  ctabla,
  nregistro_id,
  cdetalle,
  cip,
  tcreado
)
VALUES (
  NULL,
  'system',
  'SUPABASE_CATALOGOS_PRECIOS_FASE4',
  'schema_data',
  NULL,
  'Catalogos familia/categoria poblados; productos mapeados; precios canonicos backfilled desde columnas legacy en staging.',
  '127.0.0.1',
  CURRENT_TIMESTAMP
);

COMMIT;
