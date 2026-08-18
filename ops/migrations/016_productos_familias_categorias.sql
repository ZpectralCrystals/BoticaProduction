-- ═════════════════════════════════════════════════════════════
-- 016_productos_familias_categorias.sql
-- Catálogos CRUD para familias y categorías de productos.
--
-- Compatibilidad:
-- - bot_productos.cfamilia / ccategoria se conservan.
-- - nfamilia_id / ncategoria_id agregan relación nueva.
-- - valores texto existentes se migran a catálogos.
-- ═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bot_familias_producto (
  nid SERIAL PRIMARY KEY,
  cnombre VARCHAR(100) NOT NULL,
  cdescripcion TEXT,
  cestado CHAR(1) NOT NULL DEFAULT 'A',
  tcreado TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  tmodifi TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_categorias_producto (
  nid SERIAL PRIMARY KEY,
  nfamilia_id INTEGER REFERENCES bot_familias_producto(nid),
  cnombre VARCHAR(100) NOT NULL,
  cdescripcion TEXT,
  cestado CHAR(1) NOT NULL DEFAULT 'A',
  tcreado TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  tmodifi TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

ALTER TABLE bot_productos
  ADD COLUMN IF NOT EXISTS nfamilia_id INTEGER REFERENCES bot_familias_producto(nid),
  ADD COLUMN IF NOT EXISTS ncategoria_id INTEGER REFERENCES bot_categorias_producto(nid);

INSERT INTO bot_familias_producto (cnombre)
SELECT DISTINCT BTRIM(p.cfamilia)
FROM bot_productos p
WHERE p.cfamilia IS NOT NULL
  AND BTRIM(p.cfamilia) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM bot_familias_producto f
    WHERE f.cestado = 'A'
      AND LOWER(BTRIM(f.cnombre)) = LOWER(BTRIM(p.cfamilia))
  );

WITH categoria_origen AS (
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
INSERT INTO bot_categorias_producto (cnombre, nfamilia_id)
SELECT co.cnombre, co.nfamilia_id
FROM categoria_origen co
WHERE NOT EXISTS (
  SELECT 1
  FROM bot_categorias_producto c
  WHERE c.cestado = 'A'
    AND LOWER(BTRIM(c.cnombre)) = LOWER(BTRIM(co.cnombre))
);

UPDATE bot_productos p
SET nfamilia_id = f.nid
FROM bot_familias_producto f
WHERE p.nfamilia_id IS NULL
  AND p.cfamilia IS NOT NULL
  AND BTRIM(p.cfamilia) <> ''
  AND f.cestado = 'A'
  AND LOWER(BTRIM(f.cnombre)) = LOWER(BTRIM(p.cfamilia));

UPDATE bot_productos p
SET ncategoria_id = c.nid
FROM bot_categorias_producto c
WHERE p.ncategoria_id IS NULL
  AND p.ccategoria IS NOT NULL
  AND BTRIM(p.ccategoria) <> ''
  AND c.cestado = 'A'
  AND LOWER(BTRIM(c.cnombre)) = LOWER(BTRIM(p.ccategoria));

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

COMMENT ON TABLE bot_familias_producto IS
  'Catálogo de familias comerciales de productos.';

COMMENT ON TABLE bot_categorias_producto IS
  'Catálogo de categorías comerciales de productos; puede estar asociada a una familia.';

COMMENT ON COLUMN bot_productos.nfamilia_id IS
  'Referencia opcional al catálogo bot_familias_producto. cfamilia se conserva por compatibilidad.';

COMMENT ON COLUMN bot_productos.ncategoria_id IS
  'Referencia opcional al catálogo bot_categorias_producto. ccategoria se conserva por compatibilidad.';
