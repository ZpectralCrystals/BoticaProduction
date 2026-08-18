-- =============================================================
-- Migración 020: Movimientos de caja + Cuentas por Pagar
-- Fecha: Mayo 2026
-- Idempotente.
--
-- OBJETIVOS:
--   1) bot_caja_movimientos: ingresos, egresos, pagos a proveedores,
--      gastos administrativos por sesión de caja.
--   2) bot_cuentas_por_pagar: cabecera de obligación cuando una
--      compra se registra como CREDITO.
--   3) bot_pagos_compras: aplicación de pago a una CXP, vinculado
--      al movimiento de caja generado.
--
-- DEPENDENCIAS:
--   - bot_caja (apertura/cierre)
--   - bot_compras (con ctipo_pago — migración 018)
--   - bot_usuarios, bot_proveedores
--
-- EJECUCIÓN:
--   psql -U botica -d botica_db -f 020_caja_movimientos_y_cxp.sql
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- 1) bot_caja_movimientos
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_caja_movimientos (
  nid           SERIAL       PRIMARY KEY,
  ncaja_id      INTEGER      NOT NULL REFERENCES bot_caja(nid) ON DELETE RESTRICT,
  ctipo         VARCHAR(20)  NOT NULL,
  nmonto        NUMERIC(10, 2) NOT NULL,
  cmetodo_pago  VARCHAR(20)  NOT NULL DEFAULT 'EFECTIVO',
  cref_tabla    VARCHAR(50),
  nref_id       INTEGER,
  cdescripcion  VARCHAR(255),
  nusuario_id   INTEGER      REFERENCES bot_usuarios(nid) ON DELETE SET NULL,
  cusuario      VARCHAR(100),
  cestado       VARCHAR(1)   NOT NULL DEFAULT 'A',
  tcreado       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_caja_mov_tipo'
  ) THEN
    ALTER TABLE bot_caja_movimientos
      ADD CONSTRAINT chk_bot_caja_mov_tipo
      CHECK (ctipo IN ('INGRESO', 'EGRESO', 'PAGO_FACTURA', 'GASTO', 'VENTA', 'DEVOLUCION'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_caja_mov_monto_pos'
  ) THEN
    ALTER TABLE bot_caja_movimientos
      ADD CONSTRAINT chk_bot_caja_mov_monto_pos
      CHECK (nmonto > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_caja_mov_metodo'
  ) THEN
    ALTER TABLE bot_caja_movimientos
      ADD CONSTRAINT chk_bot_caja_mov_metodo
      CHECK (cmetodo_pago IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'YAPE', 'PLIN', 'OTRO'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_caja_mov_caja
  ON bot_caja_movimientos(ncaja_id);

CREATE INDEX IF NOT EXISTS idx_bot_caja_mov_tipo_fecha
  ON bot_caja_movimientos(ctipo, tcreado DESC);

CREATE INDEX IF NOT EXISTS idx_bot_caja_mov_ref
  ON bot_caja_movimientos(cref_tabla, nref_id);

COMMENT ON TABLE bot_caja_movimientos IS
  'Movimientos detallados de caja (egresos, pagos, gastos). Las ventas se reflejan en bot_ventas y se proyectan aquí opcionalmente.';

-- ─────────────────────────────────────────────────────────────
-- 2) bot_cuentas_por_pagar
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_cuentas_por_pagar (
  nid                  SERIAL       PRIMARY KEY,
  ncompra_id           INTEGER      NOT NULL REFERENCES bot_compras(nid) ON DELETE RESTRICT,
  nproveedor_id        INTEGER      NOT NULL REFERENCES bot_proveedores(nid) ON DELETE RESTRICT,
  nmonto_total         NUMERIC(10, 2) NOT NULL,
  nmonto_pagado        NUMERIC(10, 2) NOT NULL DEFAULT 0,
  nsaldo               NUMERIC(10, 2) GENERATED ALWAYS AS (nmonto_total - nmonto_pagado) STORED,
  tfecha_emision       DATE         NOT NULL DEFAULT CURRENT_DATE,
  tfecha_vencimiento   DATE,
  cestado              VARCHAR(15)  NOT NULL DEFAULT 'PENDIENTE',
  cdocumento           VARCHAR(50),
  cnotas               TEXT,
  nusuario_id          INTEGER      REFERENCES bot_usuarios(nid) ON DELETE SET NULL,
  tcreado              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  tmodifi              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_cxp_estado'
  ) THEN
    ALTER TABLE bot_cuentas_por_pagar
      ADD CONSTRAINT chk_bot_cxp_estado
      CHECK (cestado IN ('PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_cxp_montos'
  ) THEN
    ALTER TABLE bot_cuentas_por_pagar
      ADD CONSTRAINT chk_bot_cxp_montos
      CHECK (nmonto_total >= 0 AND nmonto_pagado >= 0 AND nmonto_pagado <= nmonto_total);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_bot_cxp_compra'
  ) THEN
    ALTER TABLE bot_cuentas_por_pagar
      ADD CONSTRAINT uq_bot_cxp_compra UNIQUE (ncompra_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_cxp_proveedor_estado
  ON bot_cuentas_por_pagar(nproveedor_id, cestado);

CREATE INDEX IF NOT EXISTS idx_bot_cxp_pendientes
  ON bot_cuentas_por_pagar(tfecha_vencimiento)
  WHERE cestado IN ('PENDIENTE', 'PARCIAL');

-- Trigger update tmodifi
CREATE OR REPLACE FUNCTION fn_bot_cxp_tmodifi()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.tmodifi = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bot_cxp_tmodifi ON bot_cuentas_por_pagar;
CREATE TRIGGER trg_bot_cxp_tmodifi
  BEFORE UPDATE ON bot_cuentas_por_pagar
  FOR EACH ROW EXECUTE FUNCTION fn_bot_cxp_tmodifi();

COMMENT ON TABLE bot_cuentas_por_pagar IS
  'Cuentas por pagar a proveedores. Se genera 1 fila al crear compra CREDITO. Saldo = total - pagado (generated).';

-- ─────────────────────────────────────────────────────────────
-- 3) bot_pagos_compras (aplicación de pagos a CXP)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bot_pagos_compras (
  nid                  SERIAL       PRIMARY KEY,
  ncxp_id              INTEGER      NOT NULL REFERENCES bot_cuentas_por_pagar(nid) ON DELETE RESTRICT,
  ncaja_movimiento_id  INTEGER      REFERENCES bot_caja_movimientos(nid) ON DELETE SET NULL,
  nmonto               NUMERIC(10, 2) NOT NULL,
  cmetodo_pago         VARCHAR(20)  NOT NULL DEFAULT 'EFECTIVO',
  cdocumento           VARCHAR(50),
  cnotas               TEXT,
  nusuario_id          INTEGER      REFERENCES bot_usuarios(nid) ON DELETE SET NULL,
  cusuario             VARCHAR(100),
  cestado              VARCHAR(1)   NOT NULL DEFAULT 'A',
  tcreado              TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bot_pagos_compras_monto'
  ) THEN
    ALTER TABLE bot_pagos_compras
      ADD CONSTRAINT chk_bot_pagos_compras_monto
      CHECK (nmonto > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bot_pagos_compras_cxp
  ON bot_pagos_compras(ncxp_id);

COMMENT ON TABLE bot_pagos_compras IS
  'Pagos aplicados a una CXP. Suma de nmonto debe igualar bot_cuentas_por_pagar.nmonto_pagado.';

-- ─────────────────────────────────────────────────────────────
-- 4) Función helper: aplicar pago a CXP de forma atómica
--    (orquesta upsert de monto_pagado + estado)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_aplicar_pago_cxp(
  p_cxp_id INTEGER,
  p_monto NUMERIC,
  p_metodo_pago VARCHAR,
  p_caja_movimiento_id INTEGER,
  p_documento VARCHAR,
  p_notas TEXT,
  p_usuario_id INTEGER,
  p_usuario_nombre VARCHAR
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_cxp_total NUMERIC(10, 2);
  v_cxp_pagado NUMERIC(10, 2);
  v_pago_id INTEGER;
  v_nuevo_pagado NUMERIC(10, 2);
  v_estado VARCHAR(15);
BEGIN
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a 0';
  END IF;

  SELECT nmonto_total, nmonto_pagado
    INTO v_cxp_total, v_cxp_pagado
  FROM bot_cuentas_por_pagar
  WHERE nid = p_cxp_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cuenta por pagar % no encontrada', p_cxp_id;
  END IF;

  v_nuevo_pagado := v_cxp_pagado + p_monto;
  IF v_nuevo_pagado > v_cxp_total THEN
    RAISE EXCEPTION 'El pago % excede el saldo (total=%, pagado_actual=%)', p_monto, v_cxp_total, v_cxp_pagado;
  END IF;

  INSERT INTO bot_pagos_compras
    (ncxp_id, ncaja_movimiento_id, nmonto, cmetodo_pago, cdocumento, cnotas, nusuario_id, cusuario)
  VALUES
    (p_cxp_id, p_caja_movimiento_id, p_monto, p_metodo_pago, p_documento, p_notas, p_usuario_id, p_usuario_nombre)
  RETURNING nid INTO v_pago_id;

  v_estado := CASE
    WHEN v_nuevo_pagado >= v_cxp_total THEN 'PAGADA'
    WHEN v_nuevo_pagado > 0 THEN 'PARCIAL'
    ELSE 'PENDIENTE'
  END;

  UPDATE bot_cuentas_por_pagar
    SET nmonto_pagado = v_nuevo_pagado,
        cestado = v_estado
  WHERE nid = p_cxp_id;

  RETURN v_pago_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 5) Verificación
-- ─────────────────────────────────────────────────────────────
SELECT 'bot_caja_movimientos' AS tabla, COUNT(*) AS filas FROM bot_caja_movimientos
UNION ALL
SELECT 'bot_cuentas_por_pagar', COUNT(*) FROM bot_cuentas_por_pagar
UNION ALL
SELECT 'bot_pagos_compras', COUNT(*) FROM bot_pagos_compras;
