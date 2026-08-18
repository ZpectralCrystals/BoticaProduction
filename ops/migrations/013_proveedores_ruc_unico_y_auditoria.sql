-- Endurecimiento de proveedores:
-- - soporte explicito de estado ACTIVO/INACTIVO
-- - auditoria de proveedores invalidos y RUC duplicados
-- - indice unico condicional para RUC normalizado

ALTER TABLE bot_proveedores
  ALTER COLUMN cestado SET DEFAULT 'A';

UPDATE bot_proveedores
SET cestado = 'A'
WHERE cestado IS NULL OR BTRIM(cestado) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_bot_proveedores_estado_activo_inactivo'
  ) THEN
    ALTER TABLE bot_proveedores
      ADD CONSTRAINT chk_bot_proveedores_estado_activo_inactivo
      CHECK (cestado IN ('A', 'I')) NOT VALID;
  END IF;
END $$;

ALTER TABLE bot_proveedores
  VALIDATE CONSTRAINT chk_bot_proveedores_estado_activo_inactivo;

CREATE OR REPLACE VIEW vw_bot_proveedores_invalidos AS
WITH normalized AS (
  SELECT
    p.nid,
    COALESCE(p.cruc, '') AS cruc,
    COALESCE(p.cnombre, '') AS cnombre,
    COALESCE(p.ccontacto, '') AS ccontacto,
    COALESCE(p.ctelefono, '') AS ctelefono,
    COALESCE(p.cemail, '') AS cemail,
    COALESCE(p.cdireccion, '') AS cdireccion,
    COALESCE(p.cestado, 'A') AS cestado,
    REGEXP_REPLACE(COALESCE(p.cruc, ''), '\D', '', 'g') AS ruc_normalizado,
    REGEXP_REPLACE(COALESCE(p.ctelefono, ''), '\D', '', 'g') AS telefono_normalizado
  FROM bot_proveedores p
)
SELECT
  nid,
  cruc,
  cnombre,
  ccontacto,
  ctelefono,
  cemail,
  cdireccion,
  cestado,
  ARRAY_TO_STRING(
    ARRAY_REMOVE(
      ARRAY[
        CASE WHEN NULLIF(ruc_normalizado, '') IS NULL THEN 'RUC vacío' END,
        CASE WHEN NULLIF(ruc_normalizado, '') IS NOT NULL AND LENGTH(ruc_normalizado) <> 11 THEN 'RUC sin 11 dígitos' END,
        CASE WHEN NULLIF(BTRIM(cnombre), '') IS NULL THEN 'Razón social vacía' END,
        CASE WHEN NULLIF(BTRIM(ccontacto), '') IS NULL THEN 'Contacto vacío' END,
        CASE WHEN NULLIF(BTRIM(ctelefono), '') IS NULL THEN 'Teléfono vacío' END,
        CASE WHEN NULLIF(BTRIM(ctelefono), '') IS NOT NULL AND LENGTH(telefono_normalizado) < 6 THEN 'Teléfono con menos de 6 dígitos' END,
        CASE WHEN NULLIF(BTRIM(cestado), '') IS NULL OR cestado NOT IN ('A', 'I') THEN 'Estado inválido' END
      ],
      NULL
    ),
    ' | '
  ) AS observaciones
FROM normalized
WHERE
  NULLIF(ruc_normalizado, '') IS NULL
  OR LENGTH(ruc_normalizado) <> 11
  OR NULLIF(BTRIM(cnombre), '') IS NULL
  OR NULLIF(BTRIM(ccontacto), '') IS NULL
  OR NULLIF(BTRIM(ctelefono), '') IS NULL
  OR LENGTH(telefono_normalizado) < 6
  OR NULLIF(BTRIM(cestado), '') IS NULL
  OR cestado NOT IN ('A', 'I');

CREATE OR REPLACE VIEW vw_bot_proveedores_ruc_duplicados AS
WITH normalized AS (
  SELECT
    nid,
    REGEXP_REPLACE(COALESCE(cruc, ''), '\D', '', 'g') AS ruc_normalizado
  FROM bot_proveedores
)
SELECT
  ruc_normalizado AS ruc,
  COUNT(*) AS total_registros,
  STRING_AGG(nid::TEXT, ', ' ORDER BY nid) AS proveedores_ids
FROM normalized
WHERE NULLIF(ruc_normalizado, '') IS NOT NULL
GROUP BY ruc_normalizado
HAVING COUNT(*) > 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM vw_bot_proveedores_ruc_duplicados) THEN
    RAISE WARNING 'No se creó el índice único de RUC en bot_proveedores porque existen duplicados históricos. Revise vw_bot_proveedores_ruc_duplicados antes de reintentar.';
  ELSE
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS ux_bot_proveedores_ruc_normalizado
      ON bot_proveedores ((REGEXP_REPLACE(COALESCE(cruc, ''''), ''\D'', '''', ''g'')))
      WHERE NULLIF(REGEXP_REPLACE(COALESCE(cruc, ''''), ''\D'', '''', ''g''), '''') IS NOT NULL
    ';
  END IF;
END $$;
