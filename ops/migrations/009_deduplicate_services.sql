BEGIN;

WITH ranked AS (
  SELECT
    nid,
    MIN(nid) OVER (
      PARTITION BY LOWER(BTRIM(cnombre)), LOWER(BTRIM(ccategoria))
    ) AS keep_id,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(cnombre)), LOWER(BTRIM(ccategoria))
      ORDER BY nid
    ) AS rn
  FROM bot_servicios
  WHERE cestado = 'A'
),
service_map AS (
  SELECT nid AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE bot_ventas_det d
SET nservicio_id = m.keep_id
FROM service_map m
WHERE d.nservicio_id = m.duplicate_id;

WITH ranked AS (
  SELECT
    nid,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(cnombre)), LOWER(BTRIM(ccategoria))
      ORDER BY nid
    ) AS rn
  FROM bot_servicios
  WHERE cestado = 'A'
)
DELETE FROM bot_servicios s
USING ranked r
WHERE s.nid = r.nid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_servicios_nombre_categoria
  ON bot_servicios (LOWER(BTRIM(cnombre)), LOWER(BTRIM(ccategoria)))
  WHERE cestado = 'A';

COMMIT;
