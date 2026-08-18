-- =============================================================
-- Migración 019: bot_producto_precios + historial
-- Fecha: Mayo 2026
-- Idempotente.
--
-- OBJETIVOS:
--   1) bot_producto_precios: tabla canónica de precios (1..N por producto).
--      Estructura por spec:
--        id, producto_id, nombre_precio (PRECIO_1/2/3),
--        precio_venta, activo, updated_at, updated_by
--   2) bot_producto_precios_hist: historial de cambios para auditoría.
--   3) Backfill desde bot_productos.npreventa / npreventa_2 / npreventa_3.
--   4) Trigger SQL para mantener bot_productos.npreventa* en sync
--      (compat con código legacy que lee de columnas directas).
--
-- EJECUCIÓN:
--   psql -U botica -d botica_db -f 019_producto_precios_y_historial.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) Tabla canónica bot_producto_precios
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_producto_precios (
  nid           SERIAL       PRIMARY KEY,
  nproducto_id  INTEGER      NOT NULL REFERENCES bot_productos(nid) ON DELETE CASCADE,
  cnombre       VARCHAR(20)  NOT NULL,
  nprecio       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  lactivo       BOOLEAN      NOT NULL DEFAULT TRUE,
  nusuario_id   INTEGER      REFERENCES bot_usuarios(nid) ON DELETE SET NULL,
  cusuario      VARCHAR(100),
  tcreado       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  tmodifi       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_bot_producto_precios_slot'
  ) THEN
    ALTER TABLE bot_producto_precios
      ADD CONSTRAINT uq_bot_producto_precios_slot
      UNIQUE (nproducto_id, cnombre);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_producto_precios_nombre'
  ) THEN
    ALTER TABLE bot_producto_precios
      ADD CONSTRAINT chk_bot_producto_precios_nombre
      CHECK (cnombre IN ('PRECIO_1', 'PRECIO_2', 'PRECIO_3'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_producto_precios_no_neg'
  ) THEN
    ALTER TABLE bot_producto_precios
      ADD CONSTRAINT chk_bot_producto_precios_no_neg
      CHECK (nprecio >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_producto_precios_producto
  ON bot_producto_precios(nproducto_id);

CREATE INDEX IF NOT EXISTS idx_bot_producto_precios_activo
  ON bot_producto_precios(nproducto_id, lactivo)
  WHERE lactivo = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 2) Historial bot_producto_precios_hist
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_producto_precios_hist (
  nid              SERIAL      PRIMARY KEY,
  nproducto_id     INTEGER     NOT NULL REFERENCES bot_productos(nid) ON DELETE CASCADE,
  cnombre          VARCHAR(20) NOT NULL,
  nprecio_anterior NUMERIC(10, 2),
  nprecio_nuevo    NUMERIC(10, 2) NOT NULL,
  caccion          VARCHAR(20) NOT NULL DEFAULT 'UPDATE',
  nusuario_id      INTEGER     REFERENCES bot_usuarios(nid) ON DELETE SET NULL,
  cusuario         VARCHAR(100),
  tcreado          TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bot_producto_precios_hist_producto
  ON bot_producto_precios_hist(nproducto_id, tcreado DESC);

-- ─────────────────────────────────────────────────────────────
-- 3) Backfill desde columnas legacy
-- ─────────────────────────────────────────────────────────────
INSERT INTO bot_producto_precios (nproducto_id, cnombre, nprecio, lactivo, cusuario)
SELECT p.nid, 'PRECIO_1', COALESCE(p.npreventa, 0), TRUE, 'sistema_migracion'
FROM bot_productos p
WHERE p.npreventa IS NOT NULL
ON CONFLICT (nproducto_id, cnombre) DO NOTHING;

INSERT INTO bot_producto_precios (nproducto_id, cnombre, nprecio, lactivo, cusuario)
SELECT p.nid, 'PRECIO_2', p.npreventa_2, TRUE, 'sistema_migracion'
FROM bot_productos p
WHERE p.npreventa_2 IS NOT NULL AND p.npreventa_2 > 0
ON CONFLICT (nproducto_id, cnombre) DO NOTHING;

INSERT INTO bot_producto_precios (nproducto_id, cnombre, nprecio, lactivo, cusuario)
SELECT p.nid, 'PRECIO_3', p.npreventa_3, TRUE, 'sistema_migracion'
FROM bot_productos p
WHERE p.npreventa_3 IS NOT NULL AND p.npreventa_3 > 0
ON CONFLICT (nproducto_id, cnombre) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 4) Trigger sincronización producto_precios -> bot_productos.npreventa*
--    Mantiene compat con código legacy mientras se migra.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_producto_precios_legacy()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_slot VARCHAR(20);
  v_precio NUMERIC(10, 2);
  v_activo BOOLEAN;
  v_producto_id INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_slot := OLD.cnombre;
    v_producto_id := OLD.nproducto_id;
    v_precio := NULL;
    v_activo := FALSE;
  ELSE
    v_slot := NEW.cnombre;
    v_producto_id := NEW.nproducto_id;
    v_precio := CASE WHEN NEW.lactivo THEN NEW.nprecio ELSE NULL END;
    v_activo := NEW.lactivo;
  END IF;

  IF v_slot = 'PRECIO_1' THEN
    UPDATE bot_productos
      SET npreventa = COALESCE(v_precio, 0),
          tmodifi = NOW()
      WHERE nid = v_producto_id;
  ELSIF v_slot = 'PRECIO_2' THEN
    UPDATE bot_productos
      SET npreventa_2 = v_precio,
          tmodifi = NOW()
      WHERE nid = v_producto_id;
  ELSIF v_slot = 'PRECIO_3' THEN
    UPDATE bot_productos
      SET npreventa_3 = v_precio,
          tmodifi = NOW()
      WHERE nid = v_producto_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_producto_precios_legacy ON bot_producto_precios;
CREATE TRIGGER trg_sync_producto_precios_legacy
  AFTER INSERT OR UPDATE OR DELETE ON bot_producto_precios
  FOR EACH ROW EXECUTE FUNCTION fn_sync_producto_precios_legacy();

-- ─────────────────────────────────────────────────────────────
-- 5) Trigger update tmodifi en bot_producto_precios
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_bot_producto_precios_tmodifi()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.tmodifi = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_producto_precios_tmodifi ON bot_producto_precios;
CREATE TRIGGER trg_bot_producto_precios_tmodifi
  BEFORE UPDATE ON bot_producto_precios
  FOR EACH ROW EXECUTE FUNCTION fn_bot_producto_precios_tmodifi();

-- ─────────────────────────────────────────────────────────────
-- 6) Trigger historial: AFTER UPDATE en precio
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_bot_producto_precios_hist()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO bot_producto_precios_hist
      (nproducto_id, cnombre, nprecio_anterior, nprecio_nuevo, caccion, nusuario_id, cusuario)
    VALUES
      (NEW.nproducto_id, NEW.cnombre, NULL, NEW.nprecio, 'INSERT', NEW.nusuario_id, NEW.cusuario);
  ELSIF TG_OP = 'UPDATE' AND (OLD.nprecio IS DISTINCT FROM NEW.nprecio OR OLD.lactivo IS DISTINCT FROM NEW.lactivo) THEN
    INSERT INTO bot_producto_precios_hist
      (nproducto_id, cnombre, nprecio_anterior, nprecio_nuevo, caccion, nusuario_id, cusuario)
    VALUES
      (NEW.nproducto_id, NEW.cnombre, OLD.nprecio, NEW.nprecio,
       CASE WHEN OLD.lactivo <> NEW.lactivo THEN 'TOGGLE_ACTIVO' ELSE 'UPDATE' END,
       NEW.nusuario_id, NEW.cusuario);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_producto_precios_hist ON bot_producto_precios;
CREATE TRIGGER trg_bot_producto_precios_hist
  AFTER INSERT OR UPDATE ON bot_producto_precios
  FOR EACH ROW EXECUTE FUNCTION fn_bot_producto_precios_hist();

-- ─────────────────────────────────────────────────────────────
-- 7) Verificación
-- ─────────────────────────────────────────────────────────────
SELECT
  'bot_producto_precios' AS tabla,
  cnombre,
  COUNT(*) AS filas,
  ROUND(AVG(nprecio)::numeric, 2) AS precio_promedio
FROM bot_producto_precios
GROUP BY cnombre
ORDER BY cnombre;
