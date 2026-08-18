-- 017_productos_componentes.sql
-- Catálogo de principios activos / componentes y relación con productos.

BEGIN;

CREATE TABLE IF NOT EXISTS bot_componentes_producto (
  nid SERIAL PRIMARY KEY,
  cnombre VARCHAR(150) NOT NULL,
  cdescripcion TEXT,
  cestado CHAR(1) NOT NULL DEFAULT 'A',
  tcreado TIMESTAMP NOT NULL DEFAULT NOW(),
  tmodifi TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_producto_componentes (
  nid SERIAL PRIMARY KEY,
  nproducto_id INTEGER NOT NULL REFERENCES bot_productos(nid) ON DELETE CASCADE,
  ncomponente_id INTEGER NOT NULL REFERENCES bot_componentes_producto(nid) ON DELETE RESTRICT,
  cconcentracion VARCHAR(80),
  cforma VARCHAR(80),
  cnotas TEXT,
  tcreado TIMESTAMP NOT NULL DEFAULT NOW(),
  tmodifi TIMESTAMP NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_componentes_producto_estado'
  ) THEN
    ALTER TABLE bot_componentes_producto
      ADD CONSTRAINT chk_bot_componentes_producto_estado CHECK (cestado IN ('A', 'I'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_componentes_producto_nombre_no_vacio'
  ) THEN
    ALTER TABLE bot_componentes_producto
      ADD CONSTRAINT chk_bot_componentes_producto_nombre_no_vacio CHECK (BTRIM(cnombre) <> '');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_componentes_producto_nombre_activo
  ON bot_componentes_producto (LOWER(BTRIM(cnombre)))
  WHERE cestado = 'A';

CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_producto_componentes_producto_componente
  ON bot_producto_componentes (nproducto_id, ncomponente_id);

CREATE INDEX IF NOT EXISTS ix_bot_producto_componentes_producto
  ON bot_producto_componentes (nproducto_id);

CREATE INDEX IF NOT EXISTS ix_bot_producto_componentes_componente
  ON bot_producto_componentes (ncomponente_id);

-- Compatibilidad: migra el texto libre existente de cgenerico como componente maestro.
WITH legacy AS (
  SELECT MIN(BTRIM(cgenerico)) AS cnombre
  FROM bot_productos
  WHERE cgenerico IS NOT NULL AND BTRIM(cgenerico) <> ''
  GROUP BY LOWER(BTRIM(cgenerico))
)
INSERT INTO bot_componentes_producto (cnombre)
SELECT l.cnombre
FROM legacy l
WHERE NOT EXISTS (
  SELECT 1
  FROM bot_componentes_producto c
  WHERE c.cestado = 'A'
    AND LOWER(BTRIM(c.cnombre)) = LOWER(BTRIM(l.cnombre))
);

INSERT INTO bot_producto_componentes (nproducto_id, ncomponente_id)
SELECT p.nid, c.nid
FROM bot_productos p
JOIN bot_componentes_producto c
  ON c.cestado = 'A'
 AND LOWER(BTRIM(c.cnombre)) = LOWER(BTRIM(p.cgenerico))
WHERE p.cgenerico IS NOT NULL
  AND BTRIM(p.cgenerico) <> ''
ON CONFLICT (nproducto_id, ncomponente_id) DO NOTHING;

COMMIT;
