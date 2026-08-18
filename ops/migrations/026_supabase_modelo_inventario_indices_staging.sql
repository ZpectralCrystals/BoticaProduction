-- =============================================================
-- Migracion 026: modelo inventario + indices pre-Supabase (staging)
-- Fecha: Agosto 2026
-- Alcance: solo DB staging local.
--
-- Objetivos:
--   1) Quitar FK duplicada en bot_compras.nusuario_id.
--   2) Agregar indices FK de alto trafico.
--   3) Bloquear lotes vencidos ACTIVO con stock.
--   4) Sincronizar bot_productos.nstock desde lotes ACTIVO.
--   5) Bloquear stock fantasma en productos que requieren lote.
-- =============================================================

BEGIN;

DO $$
BEGIN
  IF current_database() NOT LIKE 'botica_db_staging_%' THEN
    RAISE EXCEPTION 'Migration 026 blocked: current database % is not staging', current_database();
  END IF;
END $$;

-- 1) FK duplicada: mantener fk_bot_compras_usuario (ON DELETE SET NULL).
ALTER TABLE bot_compras
  DROP CONSTRAINT IF EXISTS bot_compras_nusuario_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_bot_compras_usuario'
      AND conrelid = 'bot_compras'::regclass
  ) THEN
    ALTER TABLE bot_compras
      ADD CONSTRAINT fk_bot_compras_usuario
      FOREIGN KEY (nusuario_id) REFERENCES bot_usuarios(nid) ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Indices FK / consultas calientes.
CREATE INDEX IF NOT EXISTS idx_bot_compras_proveedor
  ON bot_compras(nproveedor_id);

CREATE INDEX IF NOT EXISTS idx_bot_compras_usuario
  ON bot_compras(nusuario_id)
  WHERE nusuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_compras_det_compra
  ON bot_compras_det(ncompra_id);

CREATE INDEX IF NOT EXISTS idx_bot_compras_det_producto
  ON bot_compras_det(nproducto_id);

CREATE INDEX IF NOT EXISTS idx_bot_ventas_usuario
  ON bot_ventas(nusuario_id)
  WHERE nusuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_ventas_det_venta
  ON bot_ventas_det(nventa_id);

CREATE INDEX IF NOT EXISTS idx_bot_ventas_det_producto
  ON bot_ventas_det(nproducto_id)
  WHERE nproducto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_ventas_det_servicio
  ON bot_ventas_det(nservicio_id)
  WHERE nservicio_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_productos_proveedor
  ON bot_productos(nproveedor_id)
  WHERE nproveedor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_caja_usuario
  ON bot_caja(nusuario_id)
  WHERE nusuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_caja_cerrado_por
  ON bot_caja(ncerrado_por_id)
  WHERE ncerrado_por_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_caja_mov_usuario
  ON bot_caja_movimientos(nusuario_id)
  WHERE nusuario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_kardex_producto_fecha
  ON bot_kardex(nproducto_id, tcreado DESC);

CREATE INDEX IF NOT EXISTS idx_bot_kardex_lote
  ON bot_kardex(nlote_id)
  WHERE nlote_id IS NOT NULL;

-- 3) Helper: stock activo por producto desde lotes.
CREATE OR REPLACE FUNCTION fn_bot_productos_stock_activo_lotes(p_producto_id INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(l.ncantidad), 0)::INTEGER
  FROM bot_lotes l
  WHERE l.nproducto_id = p_producto_id
    AND l.cestado = 'ACTIVO';
$$;

-- 4) Bloquear lote vencido ACTIVO con stock.
CREATE OR REPLACE FUNCTION fn_bot_lotes_block_expired_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.cestado = 'ACTIVO'
     AND COALESCE(NEW.ncantidad, 0) > 0
     AND NEW.dfechavencimiento < CURRENT_DATE THEN
    RAISE EXCEPTION 'Lote % vencido (%) no puede estar ACTIVO con stock %',
      COALESCE(NEW.ccodigo_lote, NEW.nid::TEXT),
      NEW.dfechavencimiento,
      NEW.ncantidad
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_lotes_block_expired_active ON bot_lotes;
CREATE TRIGGER trg_bot_lotes_block_expired_active
  BEFORE INSERT OR UPDATE OF cestado, ncantidad, dfechavencimiento
  ON bot_lotes
  FOR EACH ROW
  EXECUTE FUNCTION fn_bot_lotes_block_expired_active();

-- 5) Sincronizar cache bot_productos.nstock desde lotes.
CREATE OR REPLACE FUNCTION fn_bot_sync_producto_stock_from_lotes(p_producto_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock INTEGER;
BEGIN
  IF p_producto_id IS NULL THEN
    RETURN;
  END IF;

  SELECT fn_bot_productos_stock_activo_lotes(p_producto_id)
    INTO v_stock;

  UPDATE bot_productos p
  SET
    nstock = v_stock,
    tmodifi = CURRENT_TIMESTAMP
  WHERE p.nid = p_producto_id
    AND p.cestado = 'A'
    AND COALESCE(p.lrequiere_lote, TRUE) = TRUE
    AND COALESCE(p.nstock, 0) IS DISTINCT FROM v_stock;
END;
$$;

CREATE OR REPLACE FUNCTION fn_bot_lotes_sync_producto_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM fn_bot_sync_producto_stock_from_lotes(OLD.nproducto_id);
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF TG_OP = 'INSERT' OR NEW.nproducto_id IS DISTINCT FROM OLD.nproducto_id THEN
      PERFORM fn_bot_sync_producto_stock_from_lotes(NEW.nproducto_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_lotes_sync_producto_stock ON bot_lotes;
CREATE TRIGGER trg_bot_lotes_sync_producto_stock
  AFTER INSERT OR DELETE OR UPDATE OF nproducto_id, ncantidad, cestado
  ON bot_lotes
  FOR EACH ROW
  EXECUTE FUNCTION fn_bot_lotes_sync_producto_stock();

-- 6) Validar al commit: productos con lote no pueden tener stock fantasma.
CREATE OR REPLACE FUNCTION fn_bot_productos_validate_stock_lotes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_lotes INTEGER;
BEGIN
  IF NEW.cestado = 'A' AND COALESCE(NEW.lrequiere_lote, TRUE) = TRUE THEN
    SELECT fn_bot_productos_stock_activo_lotes(NEW.nid)
      INTO v_stock_lotes;

    IF COALESCE(NEW.nstock, 0) <> COALESCE(v_stock_lotes, 0) THEN
      RAISE EXCEPTION 'Stock fantasma bloqueado para producto %: nstock %, lotes ACTIVO %',
        NEW.nid,
        COALESCE(NEW.nstock, 0),
        COALESCE(v_stock_lotes, 0)
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_productos_validate_stock_lotes ON bot_productos;
CREATE CONSTRAINT TRIGGER trg_bot_productos_validate_stock_lotes
  AFTER INSERT OR UPDATE OF nstock, lrequiere_lote, cestado
  ON bot_productos
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION fn_bot_productos_validate_stock_lotes();

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
  'SUPABASE_MODELO_FASE3',
  'schema',
  NULL,
  'FK duplicada compras removida; indices FK creados; triggers inventario/lotes activados en staging.',
  '127.0.0.1',
  CURRENT_TIMESTAMP
);

COMMIT;
