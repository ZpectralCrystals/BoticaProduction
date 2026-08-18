BEGIN;

-- Reasigna referencias de proveedores duplicados al registro mas antiguo por RUC.
WITH ranked AS (
  SELECT
    nid,
    MIN(nid) OVER (PARTITION BY BTRIM(cruc)) AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY BTRIM(cruc) ORDER BY nid) AS rn
  FROM bot_proveedores
  WHERE NULLIF(BTRIM(cruc), '') IS NOT NULL
),
provider_map AS (
  SELECT nid AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE bot_compras c
SET nproveedor_id = m.keep_id
FROM provider_map m
WHERE c.nproveedor_id = m.duplicate_id;

WITH ranked AS (
  SELECT
    nid,
    MIN(nid) OVER (PARTITION BY BTRIM(cruc)) AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY BTRIM(cruc) ORDER BY nid) AS rn
  FROM bot_proveedores
  WHERE NULLIF(BTRIM(cruc), '') IS NOT NULL
),
provider_map AS (
  SELECT nid AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE bot_productos p
SET nproveedor_id = m.keep_id
FROM provider_map m
WHERE p.nproveedor_id = m.duplicate_id;

WITH ranked AS (
  SELECT
    nid,
    ROW_NUMBER() OVER (PARTITION BY BTRIM(cruc) ORDER BY nid) AS rn
  FROM bot_proveedores
  WHERE NULLIF(BTRIM(cruc), '') IS NOT NULL
)
DELETE FROM bot_proveedores p
USING ranked r
WHERE p.nid = r.nid
  AND r.rn > 1;

-- Reasigna referencias de medicos duplicados al registro mas antiguo por CMP.
WITH ranked AS (
  SELECT
    nid,
    MIN(nid) OVER (PARTITION BY BTRIM(ccmp)) AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY BTRIM(ccmp) ORDER BY nid) AS rn
  FROM bot_medicos
  WHERE NULLIF(BTRIM(ccmp), '') IS NOT NULL
),
doctor_map AS (
  SELECT nid AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE bot_citas c
SET nmedico_id = m.keep_id
FROM doctor_map m
WHERE c.nmedico_id = m.duplicate_id;

WITH ranked AS (
  SELECT
    nid,
    MIN(nid) OVER (PARTITION BY BTRIM(ccmp)) AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY BTRIM(ccmp) ORDER BY nid) AS rn
  FROM bot_medicos
  WHERE NULLIF(BTRIM(ccmp), '') IS NOT NULL
),
doctor_map AS (
  SELECT nid AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE bot_historial h
SET nmedico_id = m.keep_id
FROM doctor_map m
WHERE h.nmedico_id = m.duplicate_id;

WITH ranked AS (
  SELECT
    nid,
    MIN(nid) OVER (PARTITION BY BTRIM(ccmp)) AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY BTRIM(ccmp) ORDER BY nid) AS rn
  FROM bot_medicos
  WHERE NULLIF(BTRIM(ccmp), '') IS NOT NULL
),
doctor_map AS (
  SELECT nid AS duplicate_id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE bot_recetas r
SET nmedico_id = m.keep_id
FROM doctor_map m
WHERE r.nmedico_id = m.duplicate_id;

WITH ranked AS (
  SELECT
    nid,
    ROW_NUMBER() OVER (PARTITION BY BTRIM(ccmp) ORDER BY nid) AS rn
  FROM bot_medicos
  WHERE NULLIF(BTRIM(ccmp), '') IS NOT NULL
)
DELETE FROM bot_medicos m
USING ranked r
WHERE m.nid = r.nid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_proveedores_cruc
  ON bot_proveedores (cruc)
  WHERE NULLIF(BTRIM(cruc), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_medicos_ccmp
  ON bot_medicos (ccmp)
  WHERE NULLIF(BTRIM(ccmp), '') IS NOT NULL;

COMMIT;
