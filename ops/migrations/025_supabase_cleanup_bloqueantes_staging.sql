-- =============================================================
-- Migracion 025: cleanup bloqueantes pre-Supabase (staging)
-- Fecha: Agosto 2026
-- Alcance: solo DB staging local.
--
-- Objetivos:
--   1) Bloquear lote vencido activo con stock.
--   2) Recalcular nstock desde lotes ACTIVO para productos afectados.
--   3) Dejar rastro en bot_auditoria.
--
-- Seguridad:
--   Esta migracion tiene guard para no correr sobre botica_db directo.
-- =============================================================

BEGIN;

DO $$
BEGIN
  IF current_database() NOT LIKE 'botica_db_staging_%' THEN
    RAISE EXCEPTION 'Migration 025 blocked: current database % is not staging', current_database();
  END IF;
END $$;

CREATE TEMP TABLE _cleanup_025_productos (
  nproducto_id INTEGER PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO _cleanup_025_productos (nproducto_id)
VALUES
  (57),
  (59),
  (60),
  (61),
  (62)
ON CONFLICT DO NOTHING;

WITH lote_actualizado AS (
  UPDATE bot_lotes
  SET
    cestado = 'VENCIDO',
    cnotas = trim(both from concat_ws(E'\n',
      nullif(cnotas, ''),
      '[2026-08-18] Fase 2 pre-Supabase: lote vencido bloqueado en staging.'
    )),
    tmodifi = CURRENT_TIMESTAMP
  WHERE nid = 57
    AND ccodigo_lote = 'MK-7741'
    AND cestado = 'ACTIVO'
    AND ncantidad > 0
    AND dfechavencimiento < CURRENT_DATE
  RETURNING nid, nproducto_id, ccodigo_lote, dfechavencimiento, ncantidad
)
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
SELECT
  NULL,
  'system',
  'SUPABASE_CLEANUP_FASE2',
  'bot_lotes',
  nid,
  format(
    'Lote %s vencido %s con stock %s marcado como VENCIDO en staging.',
    ccodigo_lote,
    dfechavencimiento,
    ncantidad
  ),
  '127.0.0.1',
  CURRENT_TIMESTAMP
FROM lote_actualizado;

WITH stock_lotes AS (
  SELECT
    nproducto_id,
    COALESCE(SUM(ncantidad), 0)::INTEGER AS stock_activo
  FROM bot_lotes
  WHERE cestado = 'ACTIVO'
  GROUP BY nproducto_id
),
objetivo AS (
  SELECT
    p.nid,
    p.ccodigo,
    p.cnombre,
    p.nstock AS stock_anterior,
    COALESCE(s.stock_activo, 0) AS stock_nuevo
  FROM bot_productos p
  JOIN _cleanup_025_productos cp ON cp.nproducto_id = p.nid
  LEFT JOIN stock_lotes s ON s.nproducto_id = p.nid
  WHERE COALESCE(p.nstock, 0) <> COALESCE(s.stock_activo, 0)
),
productos_actualizados AS (
  UPDATE bot_productos p
  SET
    nstock = objetivo.stock_nuevo,
    tmodifi = CURRENT_TIMESTAMP
  FROM objetivo
  WHERE p.nid = objetivo.nid
  RETURNING
    p.nid,
    p.ccodigo,
    p.cnombre,
    objetivo.stock_anterior,
    objetivo.stock_nuevo
)
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
SELECT
  NULL,
  'system',
  'SUPABASE_CLEANUP_FASE2',
  'bot_productos',
  nid,
  format(
    'Producto %s (%s) nstock recalculado de %s a %s segun lotes ACTIVO.',
    ccodigo,
    cnombre,
    stock_anterior,
    stock_nuevo
  ),
  '127.0.0.1',
  CURRENT_TIMESTAMP
FROM productos_actualizados;

COMMIT;
